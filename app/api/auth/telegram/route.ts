import { NextResponse } from "next/server";
import { loginWithTelegram } from "@/lib/telegram/login";

export const dynamic = "force-dynamic";

/**
 * Exchanges a signed Telegram payload for a Supabase session.
 *
 * The Login Widget returns one of two shapes depending on how it is
 * configured in BotFather: a bot-token-signed blob (initData) or an OIDC
 * id_token. Both are accepted and verified server-side; neither is trusted
 * before that check.
 */
export async function POST(request: Request) {
  let initData: string | undefined;
  let idToken: string | undefined;

  try {
    const body = (await request.json()) as { initData?: unknown; idToken?: unknown };
    if (typeof body.initData === "string") initData = body.initData;
    if (typeof body.idToken === "string") idToken = body.idToken;
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос." }, { status: 400 });
  }

  if ((!initData || initData.length > 4096) && (!idToken || idToken.length > 4096)) {
    return NextResponse.json({ ok: false, error: "Некорректный запрос." }, { status: 400 });
  }

  const result = await loginWithTelegram(initData ?? "", idToken ?? "");
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, code: result.code }, { status: 401 });
  }

  return NextResponse.json(
    { ok: true, tokenHash: result.tokenHash },
    { headers: { "Cache-Control": "no-store" } },
  );
}