import Link from "next/link";
import { safeNext } from "@/lib/safe-redirect";

/**
 * Telegram sign-in.
 *
 * Telegram deprecated the iframe Login Widget, so this is a plain redirect to
 * their OIDC endpoint (Authorization Code + PKCE). The callback verifies the
 * returned id_token server-side before creating a session.
 */
export function TelegramLoginButton({ botId, next }: { botId?: string; next?: string }) {
  const target = safeNext(next, "/account");
  if (!botId) return null;

  return (
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
  );
}