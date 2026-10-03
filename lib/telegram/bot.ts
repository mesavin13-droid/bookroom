/**
 * Minimal Telegram Bot API client. Server-side only: the bot token must never
 * reach the browser.
 */

const API = "https://api.telegram.org";

function token() {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("[telegram] TELEGRAM_BOT_TOKEN is not set");
  return t;
}

export interface TelegramSendResult {
  ok: boolean;
  error?: string;
  /** True when Telegram says the chat is unusable, so retrying will not help. */
  permanent?: boolean;
}

/** Characters Telegram treats as markdown control characters. */
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  opts: { url?: string; urlText?: string } = {},
): Promise<TelegramSendResult> {
  const markup = opts.url
    ? { inline_keyboard: [[{ text: opts.urlText ?? "Открыть", url: opts.url }]] }
    : undefined;

  let res: Response;
  try {
    res = await fetch(`${API}/bot${token()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: markup,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }

  let description = `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { ok?: boolean; description?: string };
    if (res.ok && body.ok) return { ok: true };
    description = body.description ?? description;
  } catch {
    /* keep the status-code message */
  }

  // 400/403 mean the chat is blocked, never started, or the text was rejected:
  // retrying cannot fix that, so the row must not be requeued forever.
  const permanent = res.status === 400 || res.status === 403;
  return { ok: false, error: description, permanent };
}

/** Booking notification text shared by both audiences. */
export function bookingMessage(title: string, body: string | null, siteUrl: string, slug: string, token: string) {
  const safeTitle = escapeHtml(title);
  const safeBody = body ? escapeHtml(body) : "";
  return {
    text: `${safeTitle}${safeBody ? `\n\n${safeBody}` : ""}`,
    url: `${siteUrl}/s/${encodeURIComponent(slug)}/booking/${encodeURIComponent(token)}`,
  };
}

export async function getMe() {
  const res = await fetch(`${API}/bot${token()}/getMe`, { signal: AbortSignal.timeout(15_000) });
  const body = (await res.json()) as { ok: boolean; result?: { username: string; first_name: string } };
  return body.ok && body.result ? body.result : null;
}