"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/**
 * Lets the studio owner receive booking notifications in Telegram.
 *
 * A bot can only message a user who has started it, so the flow is: open the
 * bot, press Start, then the Mini App reports the chat id back. We store the id
 * server-side (RPC with a studio-role check), never trusting the client.
 */
export function ConnectTelegramButton({ studioId, botUsername, connected }: { studioId: string; botUsername?: string; connected: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const botUrl = botUsername ? `https://t.me/${botUsername.replace(/^@/, "")}` : null;
  // Mini App url: read back the chat id once the user has pressed Start.
  const appUrl =
    typeof window !== "undefined" ? `${window.location.origin}/tg?claim=${encodeURIComponent(studioId)}` : null;

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("claim") !== studioId) return;
    // Give the session endpoint a moment to finish before asking for the chat.
    const t = setTimeout(() => void claim(studioId), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studioId]);

  async function claim(id: string) {
    setPending(true);
    try {
      const w = window as Window & { Telegram?: { WebApp?: { initData?: string } } };
      const initData = w.Telegram?.WebApp?.initData;
      if (!initData) {
        setMessage("Откройте приложение из самого Telegram — тогда бот сможет писать вам.");
        return;
      }
      const res = await fetch("/api/telegram/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });
      const body = (await res.json()) as { ok: boolean; chatId?: string | null; error?: string };
      if (!body.ok) {
        setMessage(body.error ?? "Не удалось подтвердить Telegram.");
        return;
      }
      if (!body.chatId) {
        setMessage("Подключите личный чат: откройте приложение из диалога с ботом, не из группы.");
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.rpc("claim_studio_telegram", {
        p_studio_id: id,
        p_chat_id: Number(body.chatId),
      });
      if (error) {
        setMessage("Не удалось сохранить. Попробуйте ещё раз.");
        return;
      }
      toast.success("Telegram подключён");
      router.refresh();
    } catch {
      setMessage("Нет соединения с сервером.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-[1.5rem] border border-border p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-medium">Уведомления в Telegram</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {connected
              ? "Подключено. Новые записи и отмены приходят сообщением."
              : "Бот пришлёт новые записи, отмены и переносы прямо в чат."}
          </p>
        </div>
        {botUrl && (
          <a
            href={botUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-medium hover:bg-surface-60"
          >
            {connected ? "Открыть бота" : "Подключить"}
          </a>
        )}
      </div>
      {!connected && botUrl && appUrl && (
        <ol className="grid gap-1.5 text-sm text-muted-foreground">
          <li>1. Откройте бота и нажмите «Старт»</li>
          <li>2. Вернитесь сюда и нажмите «Готово»</li>
        </ol>
      )}
      {!connected && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void claim(studioId)}
          className="inline-flex h-10 w-fit items-center rounded-full border border-border px-4 text-sm font-medium hover:bg-surface-60 disabled:opacity-60"
        >
          {pending ? "Проверяем…" : "Готово"}
        </button>
      )}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}