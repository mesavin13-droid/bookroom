"use server";

import { revalidatePath } from "next/cache";
import { ALL_ROLES, MANAGERS, withStudioAction, type AdminContext } from "@/lib/admin/context";
import { adminAppointmentSchema, appointmentStatusSchema, fieldErrorsFrom } from "@/lib/validations";
import { zonedTimeToUtc } from "@/lib/datetime";
import { normalizePhone } from "@/lib/phone";
import { BOOKING_ERRORS, humanizeError } from "@/lib/booking/errors";
import type { ActionResult } from "@/types";

function revalidate(ctx: AdminContext, id?: string) {
  revalidatePath("/admin", "layout");
  if (id) revalidatePath(`/admin/appointments/${id}`);
  revalidatePath(`/s/${ctx.studio.slug}`);
}

async function resolveClient(ctx: AdminContext, name: string, phoneRaw: string) {
  const phone = normalizePhone(phoneRaw)!;
  const { data: existing, error } = await ctx.supabase
    .from("clients")
    .select("id")
    .eq("studio_id", ctx.studio.id)
    .eq("phone", phone)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing.id as string;
  const { data, error: insErr } = await ctx.supabase
    .from("clients")
    .insert({ studio_id: ctx.studio.id, name, phone })
    .select("id")
    .single();
  if (insErr) throw insErr;
  return data.id as string;
}

export async function saveAdminAppointment(input: unknown) {
  return withStudioAction(MANAGERS, async (ctx): Promise<ActionResult<{ id: string }>> => {
    const parsed = adminAppointmentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Проверьте поля.", fieldErrors: fieldErrorsFrom(parsed.error) };
    const v = parsed.data;

    const { data: service, error: sErr } = await ctx.supabase
      .from("services")
      .select("id, duration_minutes, duration_days")
      .eq("id", v.serviceId)
      .eq("studio_id", ctx.studio.id)
      .maybeSingle();
    if (sErr) return { ok: false, error: humanizeError(sErr) };
    if (!service) return { ok: false, error: BOOKING_ERRORS.SERVICE_NOT_FOUND! };

    const start = zonedTimeToUtc(v.date, v.time.slice(0, 5), ctx.studio.timezone);
    let end = new Date(start.getTime() + service.duration_minutes * 60_000);
    if (service.duration_days) {
      const { data: endAt, error: endErr } = await ctx.supabase.rpc("admin_booking_end", {
        p_service_id: v.serviceId,
        p_staff_id: v.staffId,
        p_start_at: start.toISOString(),
      });
      if (endErr) {
        return { ok: false, error: "Многодневная услуга начинается в начале рабочего дня и требует нужное число рабочих дней.", fieldErrors: { time: "Укажите время открытия" } };
      }
      end = new Date(endAt as string);
    }
    const clientId = await resolveClient(ctx, v.clientName, v.clientPhone);

    const row = {
      studio_id: ctx.studio.id,
      client_id: clientId,
      staff_id: v.staffId,
      service_id: v.serviceId,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      price: v.price,
      notes: v.notes || null,
      vehicle_model: v.vehicleModel || null,
      vehicle_plate: v.vehiclePlate ? v.vehiclePlate.toUpperCase() : null,
      status: v.status,
      cancelled_at: v.status === "cancelled" ? new Date().toISOString() : null,
    };

    const res = v.id
      ? await ctx.supabase.from("appointments").update(row).eq("id", v.id).eq("studio_id", ctx.studio.id).select("id").single()
      : await ctx.supabase
          .from("appointments")
          .insert({ ...row, source: "admin", created_by: ctx.user.id })
          .select("id")
          .single();
    if (res.error) {
      if (res.error.code === "23P01") {
        return { ok: false, error: "У специалиста уже есть запись на это время.", code: "SLOT_TAKEN", fieldErrors: { time: "Время занято" } };
      }
      return { ok: false, error: humanizeError(res.error) };
    }
    revalidate(ctx, res.data.id);
    return { ok: true, data: { id: res.data.id as string } };
  });
}

export async function setAppointmentStatus(input: unknown) {
  return withStudioAction(ALL_ROLES, async (ctx): Promise<ActionResult> => {
    const parsed = appointmentStatusSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Некорректный статус." };
    const { id, status } = parsed.data;
    const { data, error } = await ctx.supabase
      .from("appointments")
      .update({ status, cancelled_at: status === "cancelled" ? new Date().toISOString() : null })
      .eq("id", id)
      .eq("studio_id", ctx.studio.id)
      .select("id");
    if (error) {
      if (error.code === "23P01") return { ok: false, error: "Это время уже занято другой записью, вернуть запись нельзя." };
      return { ok: false, error: humanizeError(error) };
    }
    if (!data?.length) return { ok: false, error: "Запись не найдена или нет прав." };
    revalidate(ctx, id);
    return { ok: true };
  });
}

export async function deleteAppointment(id: string) {
  return withStudioAction(["owner"], async (ctx): Promise<ActionResult> => {
    const { error } = await ctx.supabase.from("appointments").delete().eq("id", id).eq("studio_id", ctx.studio.id);
    if (error) return { ok: false, error: humanizeError(error) };
    revalidate(ctx);
    return { ok: true };
  });
}
