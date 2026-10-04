"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";
import { claimMyClients } from "@/actions/auth";
import { TelegramLoginButton } from "@/components/auth/telegram-login-button";
import { maskPhone, normalizePhone } from "@/lib/phone";
import { safeNext } from "@/lib/safe-redirect";
import { cn } from "@/lib/utils";

type Mode = "email" | "phone";
type Stage = "identify" | "code" | "password";

function authMessage(message: string | undefined) {
  const m = (message ?? "").toLowerCase();
  if (m.includes("rate") || m.includes("seconds")) return "Слишком много попыток. Подождите минуту и попробуйте снова.";
  if (m.includes("expired") || m.includes("invalid") && m.includes("otp")) return "Код неверный или устарел. Запросите новый.";
  if (m.includes("token")) return "Код неверный или устарел. Запросите новый.";
  if (m.includes("invalid login")) return "Неверный email или пароль.";
  if (m.includes("sms") || m.includes("phone provider") || m.includes("unsupported phone")) {
    return "Вход по SMS сейчас недоступен. Войдите по email.";
  }
  if (m.includes("fetch")) return "Нет соединения с сервером. Проверьте интернет.";
  return "Не получилось войти. Попробуйте ещё раз.";
}

/** Explains why a Telegram sign-in bounced back, without leaking internals. */
function telegramErrorReason(error: string | null, reason: string | null) {
  if (error !== "telegram") return error ? "Ссылка устарела. Запросите новый код." : null;
  switch (reason) {
    case "denied":
      return "Вход отменён в Telegram.";
    case "state_mismatch":
    case "bad_state":
      return "Не удалось проверить вход. Попробуйте ещё раз.";
    case "expired":
      return "Время входа истекло. Попробуйте ещё раз.";
    case "telegram_in_use":
      return "Этот Telegram уже привязан к другому аккаунту.";
    case "invalid_token":
      return "Данные Telegram не прошли проверку. Попробуйте ещё раз.";
    case "token_exchange_failed":
      return "Telegram не подтвердил вход. Проверьте настройки бота и попробуйте снова.";
    case "session_failed":
      return "Не удалось создать сессию. Попробуйте ещё раз.";
    default:
      return "Вход через Telegram не удался. Попробуйте ещё раз.";
  }
}

export function LoginForm({ defaultNext, telegramBotId, telegramBotUsername }: { defaultNext?: string; telegramBotId?: string; telegramBotUsername?: string } = {}) {
  const router = useRouter();
  const sp = useSearchParams();
  const next = safeNext(sp.get("next") ?? defaultNext ?? null);
  const [mode, setMode] = React.useState<Mode>(sp.get("phone") ? "phone" : "email");
  const [stage, setStage] = React.useState<Stage>("identify");
  const [email, setEmail] = React.useState(sp.get("email") ?? "");
  const [phone, setPhone] = React.useState(sp.get("phone") ? maskPhone(sp.get("phone")!) : "");
  const [code, setCode] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(telegramErrorReason(sp.get("error"), sp.get("reason")));
  const [pending, setPending] = React.useState(false);
  const supabase = createClient();

  async function finish() {
    await claimMyClients();
    router.replace(next);
    router.refresh();
  }

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("Проверьте email.");
    const normalized = normalizePhone(phone);
    if (mode === "phone" && !normalized) return setError("Проверьте номер телефона.");
    setPending(true);
    const { error } =
      mode === "email"
        ? await supabase.auth.signInWithOtp({
            email: email.trim().toLowerCase(),
            options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
          })
        : await supabase.auth.signInWithOtp({ phone: normalized!, options: { shouldCreateUser: true } });
    setPending(false);
    if (error) return setError(authMessage(error.message));
    setStage("code");
    toast.success(mode === "email" ? "Код отправлен на почту" : "Код отправлен по SMS");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Supabase issues 6-digit SMS codes but 8-character email tokens by default
    // (mailer_otp_length). Accept both so a misconfigured OTP length cannot lock
    // a real user out of their own account.
    if (!/^\d{6,8}$/.test(code)) return setError("Введите код из сообщения.");
    setPending(true);
    const { error } =
      mode === "email"
        ? await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: "email" })
        : await supabase.auth.verifyOtp({ phone: normalizePhone(phone)!, token: code, type: "sms" });
    if (error) {
      setPending(false);
      return setError(authMessage(error.message));
    }
    await finish();
  }

  async function withPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      setPending(false);
      return setError(authMessage(error.message));
    }
    await finish();
  }

  return (
    <div className="grid gap-6">
      {stage !== "code" && (
        <div role="tablist" className="grid grid-cols-2 rounded-full bg-surface p-1">
          {(["email", "phone"] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setStage("identify");
                setError(null);
              }}
              className={cn(
                "h-10 rounded-full text-sm font-medium transition-colors duration-150",
                mode === m ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "email" ? "Email" : "Телефон"}
            </button>
          ))}
        </div>
      )}

      {stage === "identify" && (
        <>
          {telegramBotId && (
            <>
              <TelegramLoginButton botId={telegramBotId} botUsername={telegramBotUsername} next={next} />
              <div className="flex items-center gap-3 text-xs text-subtle">
                <span className="h-px flex-1 bg-border" />
                или
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}
        <form onSubmit={requestCode} className="grid gap-4" noValidate>
          {mode === "email" ? (
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" inputMode="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </Field>
          ) : (
            <Field label="Телефон" htmlFor="phone">
              <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" autoFocus value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="+7 900 000-00-00" />
            </Field>
          )}
          <Button type="submit" size="lg" loading={pending}>
            Получить код
          </Button>
          {mode === "email" && (
            <button type="button" onClick={() => setStage("password")} className="text-sm text-muted-foreground hover:text-foreground">
              Войти с паролем
            </button>
          )}
        </form>
        </>
      )}

      {stage === "password" && (
        <form onSubmit={withPassword} className="grid gap-4">
          <Field label="Email" htmlFor="email-p">
            <Input id="email-p" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Пароль" htmlFor="password">
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" size="lg" loading={pending}>
            Войти
          </Button>
          <button type="button" onClick={() => setStage("identify")} className="text-sm text-muted-foreground hover:text-foreground">
            Войти по коду
          </button>
        </form>
      )}

      {stage === "code" && (
        <form onSubmit={verify} className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Код отправлен на <span className="text-foreground">{mode === "email" ? email : phone}</span>
          </p>
          <Field label="Код из сообщения" htmlFor="code">
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
              className="text-center text-2xl tracking-[0.5em] tabular"
              placeholder="000000"
            />
          </Field>
          <Button type="submit" size="lg" loading={pending}>
            Войти
          </Button>
          <button
            type="button"
            onClick={() => {
              setStage("identify");
              setCode("");
            }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Изменить {mode === "email" ? "email" : "номер"} или отправить снова
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/40 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
