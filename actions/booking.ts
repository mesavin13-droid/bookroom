"use server";

import { IMAGE_EXT, sniffImage } from "@/lib/image-sniff";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { cancelSchema, createBookingSchema, fieldErrorsFrom, rescheduleSchema, reviewSchema } from "@/lib/validations";
import { errorCode, humanizeError } from "@/lib/booking/errors";
import type { ActionResult, BookingDetails } from "@/types";

export async function createBooking(input: unknown): Promise<ActionResult<{ token: string; status: string }>> {
  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Проверьте данные формы.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const v = parsed.data;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("book_appointment", {
      p_studio_slug: v.slug,
      p_service_id: v.serviceId,
      p_staff_id: v.staffId,
      p_start_at: v.startAt,
      p_name: v.name,
      p_phone: v.phone,
      p_email: v.email || null,
      p_notes: v.notes || null,
      p_vehicle_model: v.vehicleModel || null,
      p_vehicle_plate: v.vehiclePlate || null,
    });
    if (error) return { ok: false, error: humanizeError(error, "Не удалось создать запись. Попробуйте ещё раз."), code: errorCode(error) };
    revalidatePath(`/s/${v.slug}`);
    return { ok: true, data: { token: data.token as string, status: data.status as string } };
  } catch (err) {
    return { ok: false, error: humanizeError(err, "Не удалось создать запись. Попробуйте ещё раз.") };
  }
}

export async function rescheduleBooking(input: unknown): Promise<ActionResult<{ token: string }>> {
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Выберите новое время." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("reschedule_booking_by_token", {
      p_token: parsed.data.token,
      p_start_at: parsed.data.startAt,
    });
    if (error) return { ok: false, error: humanizeError(error, "Не удалось перенести запись."), code: errorCode(error) };
    return { ok: true, data: { token: data.token as string } };
  } catch (err) {
    return { ok: false, error: humanizeError(err) };
  }
}

export async function cancelBooking(input: unknown): Promise<ActionResult> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Запись не найдена." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_booking_by_token", {
      p_token: parsed.data.token,
      p_reason: parsed.data.reason || null,
    });
    if (error) return { ok: false, error: humanizeError(error, "Не удалось отменить запись."), code: errorCode(error) };
    revalidatePath("/account", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: humanizeError(err) };
  }
}

const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export async function submitReview(token: string, formData: FormData): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse({
    rating: Number(formData.get("rating")),
    comment: String(formData.get("comment") ?? ""),
    authorName: String(formData.get("authorName") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: "Проверьте отзыв.", fieldErrors: fieldErrorsFrom(parsed.error) };

  try {
    const supabase = await createClient();
    const { data: booking, error: loadError } = await supabase.rpc("get_booking_by_token", { p_token: token });
    if (loadError || !booking) return { ok: false, error: "Запись не найдена." };
    const b = booking as BookingDetails;
    if (!b.can_review) return { ok: false, error: b.has_review ? "Вы уже оставили отзыв." : "Отзыв можно оставить после визита." };

    let photoUrl: string | null = null;
    const photo = formData.get("photo");
    if (photo instanceof File && photo.size > 0) {
      if (!ALLOWED_IMAGE.includes(photo.type)) return { ok: false, error: "Фото должно быть в формате JPG, PNG или WebP." };
      if (photo.size > 5 * 1024 * 1024) return { ok: false, error: "Фото больше 5 МБ." };
      if (!hasServiceRole()) return { ok: false, error: "Загрузка фото временно недоступна. Отправьте отзыв без фото." };
      const mime = await sniffImage(photo);
      if (!mime) return { ok: false, error: "Файл не похож на фото JPG, PNG или WebP." };
      const admin = createAdminClient();
      const path = `${b.studio.id}/reviews/${crypto.randomUUID()}.${IMAGE_EXT[mime]}`;
      const { error: upErr } = await admin.storage.from("gallery").upload(path, photo, { contentType: mime, upsert: false });
      if (upErr) return { ok: false, error: "Не удалось загрузить фото." };
      photoUrl = admin.storage.from("gallery").getPublicUrl(path).data.publicUrl;
    }

    const { error } = await supabase.rpc("submit_review", {
      p_token: token,
      p_rating: parsed.data.rating,
      p_comment: parsed.data.comment || null,
      p_author_name: parsed.data.authorName,
      p_photo_url: photoUrl,
    });
    if (error) return { ok: false, error: humanizeError(error, "Не удалось отправить отзыв.") };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: humanizeError(err) };
  }
}

/** Loads bookings saved on this device (private tokens kept in localStorage). */
export async function getBookingsByTokens(slug: string, tokens: string[]): Promise<BookingDetails[]> {
  const valid = [...new Set(tokens)].filter((t) => /^[0-9a-f-]{36}$/i.test(t)).slice(0, 20);
  if (!valid.length) return [];
  const supabase = await createClient();
  const rows = await Promise.all(valid.map((t) => supabase.rpc("get_booking_by_token", { p_token: t })));
  return rows
    .map((r) => r.data as BookingDetails | null)
    .filter((b): b is BookingDetails => Boolean(b) && b!.studio.slug === slug)
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
}
