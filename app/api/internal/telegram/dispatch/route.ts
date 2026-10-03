import { NextResponse } from "next/server";
import { dispatchTelegram } from "@/lib/telegram/dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Drains the Telegram outbox. Invoked by pg_cron (via pg_net) and after a
 * booking is created. Requires a shared secret so it cannot be triggered by
 * the public internet.
 */
async function handle(request: Request) {
  const expected = process.env.TELEGRAM_DISPATCH_SECRET;
  const provided = request.headers.get("x-telegram-secret");

  // Without a configured secret the endpoint stays disabled rather than open.
  if (!expected) {
    return NextResponse.json({ ok: false, error: "Dispatcher is not configured." }, { status: 503 });
  }
  if (!provided || provided !== expected) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const result = await dispatchTelegram(100);
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}