"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TelegramViewportSync } from "@/components/telegram/viewport-sync";
import { createClient } from "@/lib/supabase/client";
import { claimMyClients } from "@/actions/auth";

type State = "loading" | "denied";

/**
 * Mini App entry point.
 *
 * initData comes from the Telegram WebApp SDK (never from the URL, where it
 * would leak into server logs, browser history and Referer) and is verified
 * server-side before any session is created.
 */
export default function TelegramAppPage() {
  const router = useRouter();
  const [state, setState] = React.useState<State>("loading");
  const [message, setMessage] = React.useState("Проверяем данные Telegram…");

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      const w = window as Window & { Telegram?: { WebApp?: { initData?: string } } };
      const initData = w.Telegram?.WebApp?.initData;

      if (!initData) {
        if (!cancelled) {
          setState("denied");
          setMessage("Откройте приложение через кнопку в боте — обычная ссылка не подходит.");
        }
        return;
      }

      try {
        const res = await fetch("/api/telegram/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });
        const body = (await res.json()) as { ok: boolean; tokenHash?: string; error?: string };
        if (!body.ok || !body.tokenHash) {
          if (!cancelled) {
            setState("denied");
            setMessage(body.error ?? "Не удалось войти через Telegram.");
          }
          return;
        }

        const supabase = createClient();
        const { error } = await supabase.auth.verifyOtp({ token_hash: body.tokenHash, type: "magiclink" });
        if (error) {
          if (!cancelled) {
            setState("denied");
            setMessage("Сессия не создалась. Попробуйте ещё раз.");
          }
          return;
        }

        await claimMyClients();
        if (cancelled) return;
        router.replace("/admin");
        router.refresh();
      } catch {
        if (!cancelled) {
          setState("denied");
          setMessage("Нет соединения с сервером. Проверьте интернет.");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <>
      <TelegramViewportSync />
      <main className="container flex min-h-[var(--tg-viewport-height,100dvh)] flex-col items-center justify-center gap-4 px-4 text-center">
        {state === "loading" && <p className="text-muted-foreground">{message}</p>}
        {state === "denied" && (
          <>
            <h1 className="text-xl font-medium">Не удалось войти</h1>
            <p className="max-w-sm text-muted-foreground">{message}</p>
          </>
        )}
      </main>
    </>
  );
}