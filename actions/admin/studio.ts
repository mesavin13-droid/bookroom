"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_STUDIO_COOKIE } from "@/lib/config";
import { MANAGERS, withStudioAction } from "@/lib/admin/context";
import { uploadStudioImage, validateImage } from "@/lib/admin/upload";
import { bookingSettingsSchema, fieldErrorsFrom, studioCreateSchema, studioProfileSchema } from "@/lib/validations";
import { humanizeError } from "@/lib/booking/errors";
import { normalizePhone } from "@/lib/phone";
import { getSetupProgress } from "@/lib/admin/setup";
import type { ActionResult } from "@/types";

export async function switchStudio(formData: FormData) {
  const id = String(formData.get("studioId") ?? "");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const { data } = await supabase.from("studio_members").select("studio_id").eq("profile_id", user.id).eq("studio_id", id).maybeSingle();
  if (data) {
    (await cookies()).set(ADMIN_STUDIO_COOKIE, id, { path: "/admin", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  }
  revalidatePath("/admin", "layout");
  redirect("/admin");
}

export async function createStudio(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = studioCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Проверьте поля.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Войдите, чтобы создать студию." };
  const { data, error } = await supabase.rpc("create_studio", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_timezone: parsed.data.timezone,
    p_vertical: parsed.data.vertical,
    p_kind: parsed.data.kind,
    p_city: parsed.data.city,
    p_address: parsed.data.address || null,
    p_phone: normalizePhone(parsed.data.phone),
    p_owner_name: parsed.data.ownerName,
  });
  if (error) {
    const fieldErrors = error.message === "SLUG_TAKEN" ? { slug: "Этот адрес уже занят" } : undefined;
    return { ok: false, error: humanizeError(error), fieldErrors };
  }
  (await cookies()).set(ADMIN_STUDIO_COOKIE, data as string, { path: "/admin", httpOnly: true, sameSite: "lax", maxAge: 31536000 });
  return { ok: true, data: { id: data as string } };
}

export async function updateStudioProfile(input: unknown) {
  return withStudioAction(MANAGERS, async (ctx): Promise<ActionResult> => {
    const parsed = studioProfileSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Проверьте поля.", fieldErrors: fieldErrorsFrom(parsed.error) };
    const v = parsed.data;
    if (v.isPublished && !ctx.studio.is_published) {
      const progress = await getSetupProgress(ctx);
      if (!progress.canPublish) {
        return { ok: false, error: `Перед публикацией заполните: ${progress.missingRequired.map((m) => m.title.toLowerCase()).join(", ")}.` };
      }
    }
    const { error } = await ctx.supabase
      .from("studios")
      .update({
        name: v.name,
        slug: v.slug.toLowerCase(),
        kind: v.kind || null,
        tagline: v.tagline || null,
        description: v.description || null,
        address: v.address || null,
        city: v.city || null,
        phone: v.phone ? normalizePhone(v.phone) : null,
        email: v.email || null,
        website: v.website || null,
        telegram: v.telegram || null,
        vk: v.vk || null,
        instagram: v.instagram || null,
        timezone: v.timezone,
        vertical: v.vertical,
        is_published: v.isPublished,
      })
      .eq("id", ctx.studio.id);
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Этот адрес уже занят.", fieldErrors: { slug: "Адрес занят" } };
      return { ok: false, error: humanizeError(error) };
    }
    revalidatePath(`/s/${ctx.studio.slug}`, "layout");
    revalidatePath(`/s/${v.slug}`, "layout");
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

export async function updateBookingSettings(input: unknown) {
  return withStudioAction(MANAGERS, async (ctx): Promise<ActionResult> => {
    const parsed = bookingSettingsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Проверьте поля.", fieldErrors: fieldErrorsFrom(parsed.error) };
    const v = parsed.data;
    const { error } = await ctx.supabase
      .from("studio_settings")
      .update({
        min_notice_minutes: v.minNoticeMinutes,
        max_advance_days: v.maxAdvanceDays,
        cancel_notice_minutes: v.cancelNoticeMinutes,
        allow_reschedule: v.allowReschedule,
        auto_confirm: v.autoConfirm,
        slot_step_minutes: v.slotStepMinutes,
      })
      .eq("studio_id", ctx.studio.id);
    if (error) return { ok: false, error: humanizeError(error) };
    revalidatePath(`/s/${ctx.studio.slug}`, "layout");
    revalidatePath("/admin/settings");
    return { ok: true };
  });
}

export async function uploadBrandImage(kind: "logo" | "cover", formData: FormData) {
  return withStudioAction(MANAGERS, async (ctx): Promise<ActionResult<{ url: string }>> => {
    const file = formData.get("file");
    const invalid = validateImage(file);
    if (invalid) return { ok: false, error: invalid };
    const { url } = await uploadStudioImage(ctx, "studio-assets", kind, file as File);
    const { error } = await ctx.supabase
      .from("studios")
      .update(kind === "logo" ? { logo_url: url } : { cover_url: url })
      .eq("id", ctx.studio.id);
    if (error) return { ok: false, error: humanizeError(error) };
    revalidatePath(`/s/${ctx.studio.slug}`, "layout");
    revalidatePath("/admin/settings");
    return { ok: true, data: { url } };
  });
}

export async function removeBrandImage(kind: "logo" | "cover") {
  return withStudioAction(MANAGERS, async (ctx): Promise<ActionResult> => {
    const { error } = await ctx.supabase
      .from("studios")
      .update(kind === "logo" ? { logo_url: null } : { cover_url: null })
      .eq("id", ctx.studio.id);
    if (error) return { ok: false, error: humanizeError(error) };
    revalidatePath(`/s/${ctx.studio.slug}`, "layout");
    revalidatePath("/admin/settings");
    return { ok: true };
  });
}

export async function addGalleryImages(formData: FormData) {
  return withStudioAction(MANAGERS, async (ctx): Promise<ActionResult> => {
    const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) return { ok: false, error: "Выберите фотографии." };
    if (files.length > 10) return { ok: false, error: "Не больше 10 фото за раз." };
    for (const f of files) {
      const invalid = validateImage(f);
      if (invalid) return { ok: false, error: `${f.name}: ${invalid}` };
    }
    const { data: last } = await ctx.supabase
      .from("media")
      .select("sort_order")
      .eq("studio_id", ctx.studio.id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    let order = (last?.sort_order ?? 0) + 1;
    for (const f of files) {
      const { url, path } = await uploadStudioImage(ctx, "gallery", "gallery", f);
      const { error } = await ctx.supabase
        .from("media")
        .insert({ studio_id: ctx.studio.id, kind: "gallery", url, storage_path: path, alt: ctx.studio.name, sort_order: order++ });
      if (error) return { ok: false, error: humanizeError(error) };
    }
    revalidatePath(`/s/${ctx.studio.slug}`, "layout");
    revalidatePath("/admin/settings");
    return { ok: true };
  });
}

export async function deleteMedia(id: string) {
  return withStudioAction(MANAGERS, async (ctx): Promise<ActionResult> => {
    const { data: media } = await ctx.supabase.from("media").select("id, storage_path").eq("id", id).eq("studio_id", ctx.studio.id).maybeSingle();
    if (!media) return { ok: false, error: "Фото не найдено." };
    if (media.storage_path) await ctx.supabase.storage.from("gallery").remove([media.storage_path]);
    const { error } = await ctx.supabase.from("media").delete().eq("id", id);
    if (error) return { ok: false, error: humanizeError(error) };
    revalidatePath(`/s/${ctx.studio.slug}`, "layout");
    revalidatePath("/admin/settings");
    return { ok: true };
  });
}

export async function markStudioNotificationsRead() {
  return withStudioAction(MANAGERS, async (ctx): Promise<ActionResult> => {
    const { error } = await ctx.supabase.rpc("mark_studio_notifications_read", { p_studio_id: ctx.studio.id });
    if (error) return { ok: false, error: humanizeError(error) };
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

/** Go live / hide the public page. Publishing requires the mandatory setup steps. */
export async function setStudioPublished(publish: boolean) {
  return withStudioAction(MANAGERS, async (ctx): Promise<ActionResult> => {
    if (ctx.studio.suspended_at) return { ok: false, error: humanizeError({ message: "STUDIO_SUSPENDED" }) };
    if (publish) {
      const progress = await getSetupProgress(ctx);
      if (!progress.canPublish) {
        return { ok: false, error: `Сначала заполните: ${progress.missingRequired.map((m) => m.title.toLowerCase()).join(", ")}.` };
      }
    }
    const { error } = await ctx.supabase.from("studios").update({ is_published: publish }).eq("id", ctx.studio.id);
    if (error) return { ok: false, error: humanizeError(error) };
    revalidatePath(`/s/${ctx.studio.slug}`, "layout");
    revalidatePath("/admin", "layout");
    revalidatePath("/");
    return { ok: true };
  });
}
