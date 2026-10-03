import { NextResponse } from "next/server";
import { loginWithTelegram } from "@/lib/telegram/login";
import { telegramChatId, verifyTelegramInitData } from "@/lib/telegram/verify";

export const dynamic = "force-dynamic";

/**
 * Exchanges Mini App initData for a Supabase session.
 *
 * initData is read from the Telegram SDK in the browser rather than the URL,
 * so the signed blob never lands in server logs, browser history or Referer.
 */
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

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const tg = botToken ? verifyTelegramInitData(initData, botToken) : null;
  if (!tg) {
    return NextResponse.json({ ok: false, error: "Данные Telegram не прошли проверку." }, { status: 401 });
  }

  const result = await loginWithTelegram(initData);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, code: result.code }, { status: 401 });
  }

  // Personal chat only: a group/supergroup chat must not silently claim the
  // studio owner's notifications.
  const chatRaw = telegramChatId(initData);
  const personal = chatRaw ? Number(chatRaw) === tg.id : false;

  return NextResponse.json(
    { ok: true, tokenHash: result.tokenHash, telegramId: tg.id, chatId: personal ? String(tg.id) : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}