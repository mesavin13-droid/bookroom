import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * Telegram OIDC (Authorization Code + PKCE).
 *
 * The iframe Login Widget is deprecated: Telegram now expects a redirect to
 * oauth.telegram.org, exactly like any other OIDC provider. Supabase Auth
 * cannot be used for the token exchange because its verifier rejects the
 * secp256k1 key in Telegram's JWKS, so the exchange happens here.
 */

export const TELEGRAM_AUTHORIZE_URL = "https://oauth.telegram.org/auth";
export const TELEGRAM_TOKEN_URL = "https://oauth.telegram.org/token";
export const TELEGRAM_ISSUER = "https://oauth.telegram.org";

export interface TelegramPkce {
  verifier: string;
  challenge: string;
}

function b64url(buf: Buffer) {
  return buf.toString("base64url");
}

/** Generates a PKCE pair (S256). */
export function createPkce(): TelegramPkce {
  const verifier = b64url(randomBytes(64));
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

export function randomState() {
  return b64url(randomBytes(24));
}

export function clientId() {
  const id = process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID;
  if (!id) throw new Error("[telegram] NEXT_PUBLIC_TELEGRAM_BOT_ID is not set");
  return id;
}

function clientSecret() {
  const s = process.env.TELEGRAM_LOGIN_CLIENT_SECRET;
  if (!s) throw new Error("[telegram] TELEGRAM_LOGIN_CLIENT_SECRET is not set");
  return s;
}

/** Absolute URL Telegram sends the user back to; it must match BotFather exactly. */
export function redirectUri(siteUrl: string) {
  return `${siteUrl.replace(/\/$/, "")}/auth/telegram/callback`;
}

export function buildAuthorizeUrl(opts: {
  siteUrl: string;
  state: string;
  challenge: string;
  /** Where to continue after login, round-tripped through our own state cookie. */
  next?: string;
}) {
  const u = new URL(TELEGRAM_AUTHORIZE_URL);
  u.searchParams.set("client_id", clientId());
  u.searchParams.set("redirect_uri", redirectUri(opts.siteUrl));
  u.searchParams.set("response_type", "code");
  // `phone` is what returns a verified phone number, so the user can be
  // identified by phone without an SMS provider.
  u.searchParams.set("scope", "openid profile phone");
  u.searchParams.set("state", opts.state);
  u.searchParams.set("code_challenge", opts.challenge);
  u.searchParams.set("code_challenge_method", "S256");
  if (opts.next) u.searchParams.set("next", opts.next);
  return u.toString();
}

export interface TelegramTokenResponse {
  id_token: string;
  access_token: string;
  token_type: string;
  expires_in: number;
}

/** Exchanges an authorization code for tokens, authenticating with the bot secret. */
export async function exchangeCodeForTokens(opts: {
  code: string;
  codeVerifier: string;
  siteUrl: string;
}): Promise<TelegramTokenResponse> {
  const basic = Buffer.from(`${clientId()}:${clientSecret()}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: redirectUri(opts.siteUrl),
    client_id: clientId(),
    code_verifier: opts.codeVerifier,
  });

  const res = await fetch(TELEGRAM_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Telegram token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return JSON.parse(text) as TelegramTokenResponse;
}