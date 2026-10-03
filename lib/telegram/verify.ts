import { createHmac, timingSafeEqual, createHash } from "node:crypto";

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

/** Stable synthetic email for a Telegram-only account. */
export function telegramSyntheticEmail(telegramId: number) {
  return `tg${telegramId}@telegram.bookroom.invalid`;
}