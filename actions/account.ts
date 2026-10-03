"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFrom, notificationPrefsSchema, profileSchema } from "@/lib/validations";
import { normalizePhone } from "@/lib/phone";
import { humanizeError } from "@/lib/booking/errors";
import type { ActionResult } from "@/types";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Проверьте поля.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Сессия истекла. Войдите снова." };
  const v = parsed.data;
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: v.fullName,
      phone: v.phone ? normalizePhone(v.phone) : null,
      telegram_username: v.telegramUsername ? v.telegramUsername.replace(/^@/, "") : null,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: humanizeError(error) };
  revalidatePath("/account", "layout");
  return { ok: true };
}

export async function updateNotificationPrefs(input: unknown): Promise<ActionResult> {
  const parsed = notificationPrefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Некорректные настройки." };
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Сессия истекла. Войдите снова." };
  const { error } = await supabase
    .from("profiles")
    .update({
      notify_email: parsed.data.notifyEmail,
      notify_sms: parsed.data.notifySms,
      notify_telegram: parsed.data.notifyTelegram,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: humanizeError(error) };
  revalidatePath("/account/settings");
  return { ok: true };
}

export async function markMyNotificationsRead(): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Сессия истекла." };
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_profile_id", user.id)
    .is("read_at", null);
  if (error) return { ok: false, error: humanizeError(error) };
  revalidatePath("/account");
  return { ok: true };
}
