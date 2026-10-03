import { NextResponse } from "next/server";
import { loginWithTelegram } from "@/lib/telegram/login";

// Validates a signed Telegram payload; must never be cached.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let initData: string | undefined;
  try {
    const body = (await request.json()) as { initData?: unknown };
    initData = typeof body.initData === "string" ? body.initData : undefined;
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос." }, { status: 400 });
  }

  if (!initData || initData.length > 4096) {
    return NextResponse.json({ ok: false, error: "Некорректный запрос." }, { status: 400 });
  }

  const result = await loginWithTelegram(initData);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, code: result.code }, { status: 401 });
  }

  return NextResponse.json(
    { ok: true, tokenHash: result.tokenHash },
    { headers: { "Cache-Control": "no-store" } },
  );
}