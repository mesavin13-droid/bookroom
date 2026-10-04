"use client";

/**
 * Lets the studio owner receive booking notifications in Telegram.
 *
 * A bot can only message a user who has started it, and initData only exists
 * inside a real Mini App launch. So instead of asking the owner to come back
 * to this page (where there is no initData to read), the button opens the
 * Mini App directly through Telegram's ?startapp= deep link. The studio id
 * travels as start_param and /api/telegram/session attaches the chat server
 * side, where the role check lives.
 */
export function ConnectTelegramButton({
  studioId,
  botUsername,
  connected,
}: {
  studioId: string;
  botUsername?: string;
  connected: boolean;
}) {
  if (!botUsername) return null;
  const handle = botUsername.replace(/^@/, "");
  const botUrl = `https://t.me/${handle}`;
  // Telegram caps startapp payloads; a UUID fits comfortably.
  const appUrl = `https://t.me/${handle}?startapp=${encodeURIComponent(studioId)}`;

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
        <a
          href={connected ? botUrl : appUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-medium hover:bg-surface-60"
        >
          {connected ? "Открыть бота" : "Подключить"}
        </a>
      </div>
      {!connected && (
        <ol className="grid gap-1.5 text-sm text-muted-foreground">
          <li>1. Нажмите «Подключить» — откроется бот</li>
          <li>2. Нажмите «Старт», если он ещё не нажат</li>
          <li>3. Вернитесь сюда и обновите страницу</li>
        </ol>
      )}
    </div>
  );
}