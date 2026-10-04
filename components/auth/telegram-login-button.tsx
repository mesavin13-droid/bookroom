import Link from "next/link";
import * as React from "react";
import { safeNext } from "@/lib/safe-redirect";

/**
 * Telegram sign-in.
 *
 * Telegram deprecated the iframe Login Widget, so this is a plain redirect to
 * their OIDC endpoint (Authorization Code + PKCE). The callback verifies the
 * returned id_token server-side before creating a session.
 *
 * That redirect cannot work from inside a Telegram in-app webview: the page is
 * framed, and oauth.telegram.org answers with X-Frame-Options: SAMEORIGIN, so
 * the browser blocks it ("site refuses to connect"). Inside Telegram the Mini
 * App is the right entry point anyway, so we switch the button to it there.
 */
export function TelegramLoginButton({ botId, botUsername, next }: { botId?: string; botUsername?: string; next?: string }) {
  const target = safeNext(next, "/account");
  const [inTelegram, setInTelegram] = React.useState(false);

  React.useEffect(() => {
    const w = window as Window & { Telegram?: { WebApp?: unknown } };
    setInTelegram(Boolean(w.Telegram?.WebApp));
  }, []);

  if (!botId) return null;

  if (inTelegram && botUsername) {
    return (
      <div>
        <a
          href={`https://t.me/${botUsername.replace(/^@/, "")}?startapp=${encodeURIComponent(target.slice(1))}`}
          className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-border bg-surface px-4 text-sm font-medium transition-colors hover:bg-surface-60"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M21.9 4.3 18.6 20c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6 12.5 1.1 11c-1.1-.3-1.1-1.1.2-1.6l19-7.3c.9-.3 1.6.2 1.6 1.2z" />
          </svg>
          Войти через Telegram
        </a>
        <p className="mt-2 text-center text-xs text-subtle">Откроется приложение внутри Telegram.</p>
      </div>
    );
  }

  return (
    <div>
      <Link
        href={`/api/auth/telegram/start?next=${encodeURIComponent(target)}`}
        prefetch={false}
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-border bg-surface px-4 text-sm font-medium transition-colors hover:bg-surface-60"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M21.9 4.3 18.6 20c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6 12.5 1.1 11c-1.1-.3-1.1-1.1.2-1.6l19-7.3c.9-.3 1.6.2 1.6 1.2z" />
        </svg>
        Войти через Telegram
      </Link>
      <p className="mt-2 text-center text-xs text-subtle">
        Telegram откроется в приложении. Если оно не установлено — на странице
        входа есть вход по QR-коду.
      </p>
    </div>
  );
}