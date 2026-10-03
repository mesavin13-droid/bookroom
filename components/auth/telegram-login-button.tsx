"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { claimMyClients } from "@/actions/auth";
import { safeNext } from "@/lib/safe-redirect";

/**
 * Options accepted by Telegram.Login.init.
 *
 * Taken from the widget SDK itself, which whitelists these attributes:
 *   ['size','userpic','init_auth','request_access','radius','min_width','max_width','lang']
 * Anything outside this list is silently ignored by Telegram, so the type is
 * closed on purpose: inventing an option name here would look valid and do
 * nothing at runtime.
 */
interface TelegramLoginInitOptions {
  /** Bot id (Client ID from @BotFather). */
  bot_id: string;
  /** Lets the bot write to the user later. Required for push notifications. */
  request_access?: boolean;
  /** Silent sign-in without showing the popup. */
  init_auth?: boolean;
  /** Show the user's avatar in the button. */
  userpic?: boolean;
  size?: "small" | "medium" | "large";
  radius?: number;
  min_width?: number;
  max_width?: number;
  lang?: string;
  callback: TelegramLoginCallback;
}

type TelegramLoginCallback = (err: string | null, user?: unknown) => void;

declare global {
  interface Window {
    Telegram?: {
      Login: {
        init: (opts: TelegramLoginInitOptions, cb: TelegramLoginCallback) => void;
        /** cb is optional: the callback registered in init() receives the result. */
        open: (cb?: TelegramLoginCallback) => void;
      };
    };
  }
}

/**
 * Telegram sign-in via the official Login Widget.
 *
 * The widget returns a signature, never an identity we can trust: the payload
 * goes to our own API, which verifies it with the bot token before any session
 * is created.
 */
export function TelegramLoginButton({ clientId, next }: { clientId?: string; next?: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const target = safeNext(next ?? sp.get("next") ?? null);

  // The widget cannot initialise without a bot id, so bail out before the effect.
  React.useEffect(() => {
    if (!clientId) return;
    const w = window as Window;
    if (!w.Telegram?.Login) return;
    // Telegram fires the callback twice (init + open); keep only the first.
    let done = false;
    const handle = async (err: string | null, payload: unknown) => {
      if (done || err) return;
      // Depending on the BotFather configuration the widget returns either a
      // bot-token-signed blob or an OIDC id_token; forward whichever we got.
      const p = (payload ?? {}) as {
        id?: number;
        hash?: string;
        auth_date?: number;
        id_token?: string;
        access_token?: string;
      };

      const initData = p.id && p.hash ? `id=${p.id}&hash=${p.hash}&auth_date=${p.auth_date ?? 0}` : undefined;
      const idToken = p.id_token;
      if (!initData && !idToken) {
        setError("Telegram не передал данные. Попробуйте ещё раз.");
        return;
      }

      setPending(true);
      try {
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(initData ? { initData } : { idToken }),
        });
        const body = (await res.json()) as { ok: boolean; tokenHash?: string; error?: string };
        if (!body.ok || !body.tokenHash) {
          setError(body.error ?? "Не удалось войти через Telegram.");
          return;
        }
        const supabase = createClient();
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: body.tokenHash,
          type: "magiclink",
        });
        if (verifyError) {
          setError("Сессия не создалась. Попробуйте ещё раз.");
          return;
        }
        await claimMyClients();
        toast.success("Вы вошли через Telegram");
        router.replace(target);
        router.refresh();
      } catch {
        setError("Нет соединения с сервером. Проверьте интернет.");
      } finally {
        setPending(false);
      }
    };
    w.Telegram.Login.init(
      {
        bot_id: clientId,
        // Lets the bot message the user afterwards, which is what the studio
        // push notifications depend on.
        request_access: true,
        callback: handle,
      },
      handle,
    );
    // The widget popup needs user activation, so it opens on click.
    return () => {
      done = true;
    };
  }, [clientId, router, target]);

  if (!clientId) return null;

  return (
    <div className="grid gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          window.Telegram?.Login.open();
        }}
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-border bg-surface px-4 text-sm font-medium transition-colors hover:bg-surface-60 disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M21.9 4.3 18.6 20c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6 12.5 1.1 11c-1.1-.3-1.1-1.1.2-1.6l19-7.3c.9-.3 1.6.2 1.6 1.2z" />
        </svg>
        {pending ? "Входим…" : "Войти через Telegram"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}