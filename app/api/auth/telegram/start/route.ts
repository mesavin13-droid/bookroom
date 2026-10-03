import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SITE_URL } from "@/lib/config";
import { buildAuthorizeUrl, clientId, createPkce, randomState } from "@/lib/telegram/oidc";
import { safeNext } from "@/lib/safe-redirect";

export const dynamic = "force-dynamic";

// PKCE verifier and CSRF state live in short-lived httpOnly cookies; they must
// never appear in a URL that could leak through logs or Referer.
const COOKIE = "br_tg_oidc";
const TTL_MS = 10 * 60 * 1000;

/** Starts the Telegram OIDC redirect flow. */
export async function GET(request: Request) {
  if (!process.env.TELEGRAM_LOGIN_CLIENT_SECRET || !clientIdOrNull()) {
    return NextResponse.redirect(new URL("/login?error=telegram", request.url), 302);
  }

  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"), "/account");
  const { verifier, challenge } = createPkce();
  const state = randomState();

  const jar = await cookies();
  jar.set(COOKIE, JSON.stringify({ verifier, state, next, at: Date.now() }), {
    httpOnly: true,
    sameSite: "lax",
    secure: SITE_URL.startsWith("https://"),
    path: "/",
    maxAge: TTL_MS / 1000,
  });

  return NextResponse.redirect(buildAuthorizeUrl({ siteUrl: SITE_URL, state, challenge, next }), 302);
}

function clientIdOrNull() {
  try {
    clientId();
    return true;
  } catch {
    return false;
  }
}