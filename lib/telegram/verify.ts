import {
  constants,
  createHmac,
  timingSafeEqual,
  createHash,
  createPublicKey,
  verify,
  type JsonWebKey,
} from "node:crypto";

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

/** Why an initData payload was rejected. Useful in server logs, never shown raw. */
export type InitDataFailure =
  | "missing_hash"
  | "bad_signature"
  | "missing_auth_date"
  | "expired"
  | "future_dated"
  | "missing_user"
  | "bad_user";

export type InitDataResult = { ok: true; user: TelegramUser } | { ok: false; reason: InitDataFailure };

/**
 * Validates initData step by step and reports where it failed.
 *
 * A stale payload (replay window) and a forged signature are both security
 * rejects, but they mean very different things operationally, so callers can
 * tell them apart in logs.
 */
export function verifyTelegramInitDataDetailed(
  initData: TelegramInitData,
  botToken: string,
  maxAgeSeconds = MAX_AGE_SECONDS,
): InitDataResult {
  if (!initData || !botToken) return { ok: false, reason: "bad_signature" };
  const parsed = parseInitData(initData);
  if (!parsed) return { ok: false, reason: "missing_hash" };

  const secret = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(parsed.dataCheckString).digest("hex");
  if (!safeEqual(expected, parsed.hash)) return { ok: false, reason: "bad_signature" };

  const authDate = Number(parsed.params.get("auth_date") ?? "0");
  if (!Number.isFinite(authDate) || authDate <= 0) return { ok: false, reason: "missing_auth_date" };
  const age = Math.floor(Date.now() / 1000) - authDate;
  if (age > maxAgeSeconds) return { ok: false, reason: "expired" };
  // Reject payloads from the future: they would otherwise never expire.
  if (age < -300) return { ok: false, reason: "future_dated" };

  const rawUser = parsed.params.get("user");
  if (!rawUser) return { ok: false, reason: "missing_user" };
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
    if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, reason: "bad_user" };
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
    return {
      ok: true,
      user: {
        id,
        username: u.username ?? null,
        name: name || null,
        phone: u.phone_number ?? null,
        phoneVerified: Boolean(u.phone_number_verified),
        photoUrl: u.photo_url ?? null,
      },
    };
  } catch {
    return { ok: false, reason: "bad_user" };
  }
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
  const result = verifyTelegramInitDataDetailed(initData, botToken, maxAgeSeconds);
  return result.ok ? result.user : null;
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
// The login flow may hand back an id_token instead of a bot-token hash, so both
// shapes are supported.
//
// Telegram publishes four keys and lets the bot owner pick the signing algorithm
// in BotFather (Login Widget -> Advanced), so verification cannot hardcode
// RS256: RS*, PS*, ES256, ES256K and EdDSA all have to work. Supabase Auth
// cannot follow along because its go-jose verifier rejects the secp256k1 key.
// ---------------------------------------------------------------------------
const JWKS_URL = "https://oauth.telegram.org/.well-known/jwks.json";
const ISSUER = "https://oauth.telegram.org";

type Jwk = { kid?: string; kty?: string; alg?: string; crv?: string; n?: string; e?: string; x?: string; y?: string };

let jwksCache: Jwk[] | null = null;
let jwksFetchedAt = 0;

/** Algorithms we accept, mapped to the Node crypto verification call. */
const ALGOS = {
  RS256: { type: "rsa", digest: "RSA-SHA256" },
  RS384: { type: "rsa", digest: "RSA-SHA384" },
  RS512: { type: "rsa", digest: "RSA-SHA512" },
  PS256: { type: "rsa-pss", digest: "RSA-SHA256", pss: true },
  PS384: { type: "rsa-pss", digest: "RSA-SHA384", pss: true },
  PS512: { type: "rsa-pss", digest: "RSA-SHA512", pss: true },
  ES256: { type: "ecdsa", digest: "SHA256" },
  ES256K: { type: "ecdsa", digest: "SHA256" },
  EdDSA: { type: "ed25519", digest: null },
} as const satisfies Record<string, { type: string; digest: string | null; pss?: boolean }>;

type KnownAlg = keyof typeof ALGOS;

/** Key type the algorithm requires, so a curve mismatch cannot slip through. */
function expectedKty(alg: KnownAlg) {
  if (ALGOS[alg].type === "ed25519") return "OKP";
  if (ALGOS[alg].type === "ecdsa") return "EC";
  return "RSA";
}

async function getKey(kid: string, alg: KnownAlg) {
  const stale = Date.now() - jwksFetchedAt > 60 * 60 * 1000;
  if (!jwksCache || stale) {
    const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { keys?: Jwk[] };
    jwksCache = body.keys ?? [];
    jwksFetchedAt = Date.now();
  }
  // The kid alone is not enough: require the key type to match the algorithm so
  // an RSA key can never be handed to an ECDSA check.
  const found = jwksCache.find((k) => k.kid === kid && k.kty === expectedKty(alg));
  if (!found) return null;
  try {
    return createPublicKey({ key: found as unknown as JsonWebKey, format: "jwk" });
  } catch {
    return null;
  }
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

  // Only algorithms we can actually verify; "none" and anything unknown is out.
  const alg = header.alg as KnownAlg | undefined;
  if (!alg || !Object.prototype.hasOwnProperty.call(ALGOS, alg)) return null;
  if (!header.kid) return null;
  if (payload.iss !== ISSUER) return null;
  // aud must be this bot, never another one.
  const aud = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
  if (aud !== botId && aud !== Number(botId)) return null;

  const exp = Number(payload.exp ?? 0);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;

  const key = await getKey(header.kid, alg);
  if (!key) return null;

  let valid = false;
  try {
    const spec = ALGOS[alg];
    if (spec.type === "rsa-pss") {
      // RSA-PSS needs an explicit padding and salt length; a plain "rsa-pss"
      // call without them would silently accept PKCS#1 v1.5 signatures.
      valid = verify(spec.digest as string, Buffer.from(p), {
        key,
        padding: constants.RSA_PKCS1_PSS_PADDING,
        saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
      }, Buffer.from(sig, "base64url"));
    } else if (spec.digest === null) {
      valid = verify(null, Buffer.from(p), key, Buffer.from(sig, "base64url"));
    } else {
      valid = verify(spec.digest, Buffer.from(p), key, Buffer.from(sig, "base64url"));
    }
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