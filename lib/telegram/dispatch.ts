import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/config";
import { bookingMessage, sendTelegramMessage } from "@/lib/telegram/bot";

interface PendingRow {
  delivery_id: string;
  chat_id: number | null;
  title: string | null;
  body: string | null;
  studio_name: string | null;
  studio_slug: string | null;
  appointment_id: string | null;
  manage_token: string | null;
}

export interface DispatchResult {
  sent: number;
  failed: number;
  requeued: number;
}

/**
 * Drains the notification_deliveries outbox for the Telegram channel.
 *
 * Rows are claimed atomically in SQL (pending -> sending) so two concurrent
 * calls cannot deliver the same notification twice. Called right after a
 * booking and periodically as a safety net.
 */
export async function dispatchTelegram(limit = 50): Promise<DispatchResult> {
  if (!process.env.TELEGRAM_BOT_TOKEN || !hasServiceRoleKey()) {
    return { sent: 0, failed: 0, requeued: 0 };
  }

  const admin = createAdminClient();
  const result: DispatchResult = { sent: 0, failed: 0, requeued: 0 };

  // Client recipients and studio owners use separate claim functions because
  // the chat id lives in a different table for each.
  const claims: { fn: string; rows: PendingRow[] }[] = [
    { fn: "claim_pending_telegram", rows: [] },
    { fn: "claim_pending_studio_telegram", rows: [] },
  ];

  for (const c of claims) {
    const { data, error } = await admin.rpc(c.fn, { p_limit: limit });
    if (error) {
      console.error("[telegram] claim failed", c.fn, error.message);
      continue;
    }
    c.rows = (data ?? []) as PendingRow[];
  }

  for (const c of claims) {
    for (const row of c.rows) {
      if (!row.chat_id || !row.title) {
        await admin.rpc("finish_telegram_delivery", {
          p_delivery_id: row.delivery_id,
          p_ok: false,
          p_error: "no chat id",
        });
        result.failed++;
        continue;
      }

      const msg = bookingMessage(
        row.title,
        row.body,
        SITE_URL,
        row.studio_slug ?? "",
        row.manage_token ?? "",
      );

      const res = await sendTelegramMessage(row.chat_id, msg.text, {
        url: msg.url,
        urlText: "Открыть запись",
      });

      await admin.rpc("finish_telegram_delivery", {
        p_delivery_id: row.delivery_id,
        p_ok: res.ok,
        p_error: res.ok ? null : res.error,
      });

      if (res.ok) result.sent++;
      else if (res.permanent) result.failed++;
      else result.requeued++;
    }
  }

  return result;
}

function hasServiceRoleKey() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}