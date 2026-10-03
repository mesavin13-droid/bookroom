"use server";

import { revalidatePath } from "next/cache";
import { MANAGERS, withStudioAction, type AdminContext } from "@/lib/admin/context";
import { dayOffSchema, fieldErrorsFrom, weeklyScheduleSchema } from "@/lib/validations";
import { humanizeError } from "@/lib/booking/errors";
import type { ActionResult } from "@/types";

function revalidate(ctx: AdminContext) {
  revalidatePath("/admin/schedule");
  revalidatePath("/admin/calendar");
  revalidatePath(`/s/${ctx.studio.slug}`, "layout");
}

export async function saveWeeklySchedule(input: unknown) {
  return withStudioAction(MANAGERS, async (ctx): Promise<ActionResult> => {
    const parsed = weeklyScheduleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте расписание.", fieldErrors: fieldErrorsFrom(parsed.error) };
    const v = parsed.data;
    for (const b of v.breaks) {
      const day = v.days.find((d) => d.weekday === b.weekday);
      if (day?.isWorking && (b.start < day.start || b.end > day.end)) {
        return { ok: false, error: "Перерыв должен быть внутри рабочего времени." };
      }
    }
    const { error: upErr } = await ctx.supabase.from("staff_schedules").upsert(
      v.days.map((d) => ({
        studio_id: ctx.studio.id,
        staff_id: v.staffId,
        weekday: d.weekday,
        is_working: d.isWorking,
        start_time: d.start,
        end_time: d.end,
      })),
      { onConflict: "staff_id,weekday" },
    );
    if (upErr) return { ok: false, error: humanizeError(upErr) };
    const { error: delErr } = await ctx.supabase.from("schedule_breaks").delete().eq("staff_id", v.staffId).eq("studio_id", ctx.studio.id);
    if (delErr) return { ok: false, error: humanizeError(delErr) };
    const workingDays = new Set(v.days.filter((d) => d.isWorking).map((d) => d.weekday));
    const breaks = v.breaks.filter((b) => workingDays.has(b.weekday));
    if (breaks.length) {
      const { error } = await ctx.supabase.from("schedule_breaks").insert(
        breaks.map((b) => ({ studio_id: ctx.studio.id, staff_id: v.staffId, weekday: b.weekday, start_time: b.start, end_time: b.end })),
      );
      if (error) return { ok: false, error: humanizeError(error) };
    }
    revalidate(ctx);
    return { ok: true };
  });
}

export async function addDayOff(input: unknown) {
  return withStudioAction(MANAGERS, async (ctx): Promise<ActionResult> => {
    const parsed = dayOffSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте даты.", fieldErrors: fieldErrorsFrom(parsed.error) };
    const v = parsed.data;
    const { error } = await ctx.supabase.from("days_off").insert({
      studio_id: ctx.studio.id,
      staff_id: v.staffId,
      start_date: v.startDate,
      end_date: v.endDate,
      kind: v.kind,
      reason: v.reason || null,
    });
    if (error) return { ok: false, error: humanizeError(error) };
    revalidate(ctx);
    return { ok: true };
  });
}

export async function deleteDayOff(id: string) {
  return withStudioAction(MANAGERS, async (ctx): Promise<ActionResult> => {
    const { error } = await ctx.supabase.from("days_off").delete().eq("id", id).eq("studio_id", ctx.studio.id);
    if (error) return { ok: false, error: humanizeError(error) };
    revalidate(ctx);
    return { ok: true };
  });
}
