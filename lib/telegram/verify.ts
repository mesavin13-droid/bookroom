import { createHmac, timingSafeEqual, createHash, createPublicKey, verify } from "node:crypto";

/**
 * Telegram identity verification.
 *
 * Telegram signs its payloads with HMAC-SHA256 keyed by SHA256(bot_token).
 * Everything here runs on the server: a client-supplied hash proves nothing,
 * so it must never be trusted before this check passes.
 */

/** Verified identity, as reported by Telegram. */
export interface TelegramUser {
  id: number;
  username: string | null;
  name: string | null;
  /** Only present when the phone scope was granted. */
  phone: string | null;
  /** Whether Telegram considers the phone number verified. */
  phoneVerified: boolean;
  photoUrl: string | null;
}

/** initData of a Mini App (chat context) or a Login Widget payload (web). */
export type TelegramInitData = string;

const MAX_AGE_SECONDS = 60 * 60; // one hour; Telegram's own advice for initData

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function parseInitData(initData: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  // Telegram requires the remaining fields sorted by key, joined with \n.
  const pairs = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join("\n");
  return { hash, dataCheckString, params };
}

/**
 * Validates initData and returns the user, or null when the signature is
 * invalid, the payload is too old, or Telegram reported an auth_date far in
 * the future (clock skew abuse).
 */
export function verifyTelegramInitData(
  initData: TelegramInitData,
  botToken: string,
  maxAgeSeconds = MAX_AGE_SECONDS,
): TelegramUser | null {
  if (!initData || !botToken) return null;
  const parsed = parseInitData(initData);
  if (!parsed) return null;

  const secret = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(parsed.dataCheckString).digest("hex");
  if (!safeEqual(expected, parsed.hash)) return null;

  const authDate = Number(parsed.params.get("auth_date") ?? "0");
  if (!Number.isFinite(authDate) || authDate <= 0) return null;
  const age = Math.floor(Date.now() / 1000) - authDate;
  if (age > maxAgeSeconds) return null;
  // Reject payloads from the future: they would otherwise never expire.
  if (age < -300) return null;

  const rawUser = parsed.params.get("user");
  if (!rawUser) return null;
  try {
    const u = JSON.parse(rawUser) as {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
      phone_number?: string;
      phone_number_verified?: boolean;
      photo_url?: string;
    };
    const id = Number(u.id);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
    return {
      id,
      username: u.username ?? null,
      name: name || null,
      phone: u.phone_number ?? null,
      phoneVerified: Boolean(u.phone_number_verified),
      photoUrl: u.photo_url ?? null,
    };
  } catch {
    return null;
  }
}

/** Chat id of the Mini App session, when the app was launched from a chat. */
export function telegramChatId(initData: TelegramInitData): string | null {
  try {
    const raw = new URLSearchParams(initData).get("chat");
    if (!raw) return null;
    const chat = JSON.parse(raw) as { id?: number };
    return typeof chat.id === "number" ? String(chat.id) : null;
  } catch {
    return null;
  }
}

/** Value the Mini App was launched with, via BotFather's ?startapp= link. */
export function telegramStartParam(initData: TelegramInitData): string | null {
  try {
    const raw = new URLSearchParams(initData).get("start_param");
    return raw ? raw.trim() || null : null;
  } catch {
    return null;
  }
}

/** Stable synthetic email for a Telegram-only account. */
export function telegramSyntheticEmail(telegramId: number) {
  return `tg${telegramId}@telegram.bookroom.invalid`;
}

// ---------------------------------------------------------------------------
// OIDC mode.
// The Login Widget may hand back an id_token instead of a bot-token hash, so
// both shapes are supported. Telegram publishes several keys in its JWKS and
// one of them is secp256k1, which is what breaks go-jose (and therefore
// Supabase Auth). We pick the RSA key by kid and ignore the rest.
// ---------------------------------------------------------------------------
const JWKS_URL = "https://oauth.telegram.org/.well-known/jwks.json";
const ISSUER = "https://oauth.telegram.org";
let jwksCache: { keys: { kid: string; n: string; e: string }[] } | null = null;
let jwksFetchedAt = 0;

async function rsaKey(kid: string, n: string, e: string) {
  const b64 = (s: string) => Buffer.from(s, "base64url");
  return createPublicKey({ key: { kty: "RSA", n: b64(n).toString("base64"), e: b64(e).toString("base64") }, format: "jwk" });
}

async function getRsaKey(kid: string) {
  const stale = Date.now() - jwksFetchedAt > 60 * 60 * 1000;
  if (!jwksCache || stale) {
    const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { keys?: Record<string, string>[] };
    // Keep only RSA keys: the EC/OKP entries are the ones that trip verifiers.
    jwksCache = {
      keys: (body.keys ?? [])
        .filter((k) => k.kty === "RSA" && k.kid && k.n && k.e)
        .map((k) => ({ kid: k.kid!, n: k.n!, e: k.e! })),
    };
    jwksFetchedAt = Date.now();
  }
  const found = jwksCache.keys.find((k) => k.kid === kid);
  if (!found) return null;
  return rsaKey(found.kid, found.n, found.e);
}

/** Verifies a Telegram OIDC id_token and extracts the user claims. */
export async function verifyTelegramIdToken(
  idToken: string,
  botId: string,
): Promise<TelegramUser | null> {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts as [string, string, string];

  let header: { alg?: string; kid?: string };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(h, "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (header.alg !== "RS256" || !header.kid) return null;
  if (payload.iss !== ISSUER) return null;
  // aud must be this bot, never another one.
  const aud = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
  if (aud !== botId && aud !== Number(botId)) return null;

  const exp = Number(payload.exp ?? 0);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;

  const key = await getRsaKey(header.kid);
  if (!key) return null;

  let valid = false;
  try {
    valid = verify("RSA-SHA256", Buffer.from(p), key, Buffer.from(sig, "base64url"));
  } catch {
    return null;
  }
  if (!valid) return null;

  const sub = Number(payload.sub ?? 0);
  const id = Number(payload.id ?? sub);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  const username = typeof payload.preferred_username === "string" ? payload.preferred_username : null;
  const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : null;
  const phone = typeof payload.phone_number === "string" ? payload.phone_number : null;

  return {
    id,
    username,
    name,
    phone,
    phoneVerified: Boolean(payload.phone_number_verified),
    photoUrl: typeof payload.picture === "string" ? payload.picture : null,
  };
}