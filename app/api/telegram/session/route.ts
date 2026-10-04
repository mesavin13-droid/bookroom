import { NextResponse } from "next/server";
import { linkTelegramIdentity } from "@/lib/telegram/link-identity";
import { telegramChatId, telegramStartParam, verifyTelegramInitData } from "@/lib/telegram/verify";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Guards the start_param before it reaches the database. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const result = await linkTelegramIdentity(tg);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, code: result.reason }, { status: 401 });
  }

  // Personal chat only: a group/supergroup chat must not silently claim the
  // studio owner's notifications.
  const chatRaw = telegramChatId(initData);
  const personal = chatRaw ? Number(chatRaw) === tg.id : false;

  // Landing is decided server-side so the Mini App never sends a client to the
  // studio dashboard. Someone without a studio has nothing to manage there.
  const admin = createAdminClient();
  const { data: memberships } = await admin
    .from("studio_members")
    .select("role")
    .eq("profile_id", result.userId)
    .limit(1);
  const manages = (memberships ?? []).some((m) => m.role === "owner" || m.role === "admin");

  // Launched from the owner's ?startapp=<studio> link: attach the personal chat
  // to that studio. The RPC re-checks the role, so a crafted link cannot grant
  // notification access to someone else's studio.
  const startParam = telegramStartParam(initData);
  let claimed = false;
  if (personal && startParam && UUID_RE.test(startParam)) {
    const { error: claimError } = await admin.rpc("claim_studio_telegram", {
      p_studio_id: startParam,
      p_chat_id: tg.id,
    });
    claimed = !claimError;
  }

  return NextResponse.json(
    {
      ok: true,
      tokenHash: result.tokenHash,
      telegramId: tg.id,
      chatId: personal ? String(tg.id) : null,
      landing: manages ? "/admin" : "/account",
      claimed,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}