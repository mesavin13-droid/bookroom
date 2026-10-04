"use client";

import * as React from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { TelegramViewportSync } from "@/components/telegram/viewport-sync";
import { createClient } from "@/lib/supabase/client";
import { claimMyClients } from "@/actions/auth";

type State = "loading" | "denied";

const SDK_URL = "https://telegram.org/js/telegram-web-app.js";
const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

/**
 * Opens a link from inside a Mini App.
 *
 * A plain anchor is swallowed by the Telegram WebView, so it has to go through
 * WebApp.openLink when that is available; otherwise a normal browser is fine.
 */
function openExternal(url: string) {
  const w = window as Window & { Telegram?: { WebApp?: { openLink?: (u: string) => void } } };
  const open = w.Telegram?.WebApp?.openLink;
  if (open) {
    try {
      open(url);
      return;
    } catch {
      // fall through to a plain navigation
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Waits for the Telegram WebApp SDK to appear.
 *
 * The script is injected by Next at runtime, so `window.Telegram.WebApp` is not
 * there synchronously on first render. Without this poll the page would read an
 * empty initData and wrongly report "open it from the bot".
 */
function waitForWebApp(timeoutMs = 5000): Promise<{ initData: string } | null> {
  return new Promise((resolve) => {
    const started = Date.now();
    const check = () => {
      const w = window as Window & { Telegram?: { WebApp?: { initData?: string } } };
      const initData = w.Telegram?.WebApp?.initData;
      if (initData) return resolve({ initData });
      if (Date.now() - started > timeoutMs) return resolve(null);
      setTimeout(check, 50);
    };
    check();
  });
}

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
      const { initData } = (await waitForWebApp()) ?? { initData: "" };

      if (!initData) {
        if (!cancelled) {
          setState("denied");
          setMessage(
            "Откройте приложение через кнопку BOOKROOM в боте — в обычном браузере Telegram не передаёт данные.",
          );
        }
        return;
      }

      try {
        const res = await fetch("/api/telegram/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });
        const body = (await res.json()) as {
          ok: boolean;
          tokenHash?: string;
          landing?: string;
          error?: string;
        };
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
        // The server decides: studio managers land in /admin, everyone else in
        // /account. Never guess client-side, or clients end up in the dashboard.
        router.replace(body.landing === "/admin" ? "/admin" : "/account");
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
      {/* The SDK is what exposes window.Telegram.WebApp.initData. */}
      <Script src={SDK_URL} strategy="afterInteractive" />
      <TelegramViewportSync />
      <main className="container flex min-h-[var(--tg-viewport-height,100dvh)] flex-col items-center justify-center gap-4 px-4 text-center">
        {state === "loading" && <p className="text-muted-foreground">{message}</p>}
        {state === "denied" && (
          <>
            <h1 className="text-xl font-medium">Не удалось войти</h1>
            <p className="max-w-sm text-muted-foreground">{message}</p>
            {botUsername && (
              <button
                type="button"
                onClick={() => openExternal(`https://t.me/${botUsername.replace(/^@/, "")}`)}
                className="mt-2 inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
              >
                Открыть бота
              </button>
            )}
          </>
        )}
      </main>
    </>
  );
}