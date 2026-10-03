import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/config";
import { exchangeCodeForTokens } from "@/lib/telegram/oidc";
import { verifyTelegramIdToken } from "@/lib/telegram/verify";
import { linkTelegramIdentity } from "@/lib/telegram/link-identity";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const COOKIE = "br_tg_oidc";

/**
 * Telegram redirects here after the user approves the login.
 *
 * The authorization code is exchanged for tokens, the id_token signature is
 * verified against Telegram's JWKS, and only then is a Supabase session
 * created. Anything unexpected lands on the login page with an error instead
 * of a half-authenticated state.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error");

  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  jar.delete(COOKIE);

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=telegram&reason=${encodeURIComponent(reason)}`, SITE_URL), 302);

  if (denied) return fail("denied");
  if (!code || !state || !raw) return fail("missing_code");

  let saved: { verifier: string; state: string; next: string; at: number };
  try {
    saved = JSON.parse(raw);
  } catch {
    return fail("bad_state");
  }

  // CSRF protection and a short expiry window.
  if (saved.state !== state) return fail("state_mismatch");
  if (Date.now() - saved.at > 10 * 60 * 1000) return fail("expired");

  const tokens = await exchangeCodeForTokens({
    code,
    codeVerifier: saved.verifier,
    siteUrl: SITE_URL,
  }).catch(() => null);
  if (!tokens?.id_token) return fail("token_exchange_failed");

  const tg = await verifyTelegramIdToken(tokens.id_token, process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID ?? "");
  if (!tg) return fail("invalid_token");

  // Find or create the account and attach the Telegram identity.
  const link = await linkTelegramIdentity(tg);
  if (!link.ok) return fail(link.reason);

  // Establish the session for this browser.
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: "magiclink" });
  if (error) return fail("session_failed");

  return NextResponse.redirect(new URL(saved.next || "/account", SITE_URL), 302);
}