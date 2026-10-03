"use server";

import { revalidatePath } from "next/cache";
import { MANAGERS, withStudioAction, type AdminContext } from "@/lib/admin/context";
import { uploadStudioImage, validateImage } from "@/lib/admin/upload";
import { fieldErrorsFrom, staffSchema } from "@/lib/validations";
import { humanizeError } from "@/lib/booking/errors";
import type { ActionResult } from "@/types";

function revalidate(ctx: AdminContext) {
  revalidatePath("/admin/staff", "layout");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin/services");
  revalidatePath(`/s/${ctx.studio.slug}`, "layout");
}

export async function saveStaff(formData: FormData) {
  return withStudioAction(MANAGERS, async (ctx): Promise<ActionResult<{ id: string }>> => {
    const parsed = staffSchema.safeParse({
      id: formData.get("id") || undefined,
      name: String(formData.get("name") ?? ""),
      position: String(formData.get("position") ?? ""),
      bio: String(formData.get("bio") ?? ""),
      isActive: formData.get("isActive") === "true",
      serviceIds: formData.getAll("serviceIds").map(String),
    });
    if (!parsed.success) return { ok: false, error: "Проверьте поля.", fieldErrors: fieldErrorsFrom(parsed.error) };
    const v = parsed.data;

    let photoUrl: string | undefined;
    const photo = formData.get("photo");
    if (photo instanceof File && photo.size > 0) {
      const invalid = validateImage(photo);
      if (invalid) return { ok: false, error: invalid, fieldErrors: { photo: invalid } };
      photoUrl = (await uploadStudioImage(ctx, "studio-assets", "staff", photo)).url;
    }

    const row = {
      studio_id: ctx.studio.id,
      name: v.name,
      position: v.position || null,
      bio: v.bio || null,
      is_active: v.isActive,
      ...(photoUrl ? { photo_url: photoUrl } : {}),
    };

    let id = v.id;
    if (id) {
      const { error } = await ctx.supabase.from("staff").update(row).eq("id", id).eq("studio_id", ctx.studio.id);
      if (error) return { ok: false, error: humanizeError(error) };
    } else {
      const { count } = await ctx.supabase.from("staff").select("id", { count: "exact", head: true }).eq("studio_id", ctx.studio.id);
      const { data, error } = await ctx.supabase
        .from("staff")
        .insert({ ...row, sort_order: (count ?? 0) + 1 })
        .select("id")
        .single();
      if (error) return { ok: false, error: humanizeError(error) };
      id = data.id as string;
      // Sensible default schedule: Mon–Fri 10–19, weekends off.
      const { error: schedErr } = await ctx.supabase.from("staff_schedules").insert(
        [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
          studio_id: ctx.studio.id,
          staff_id: id!,
          weekday,
          is_working: weekday <= 5,
          start_time: "10:00",
          end_time: "19:00",
        })),
      );
      if (schedErr) return { ok: false, error: humanizeError(schedErr) };
    }

    const { error: delErr } = await ctx.supabase.from("staff_services").delete().eq("staff_id", id).eq("studio_id", ctx.studio.id);
    if (delErr) return { ok: false, error: humanizeError(delErr) };
    if (v.serviceIds.length) {
      const { error: linkErr } = await ctx.supabase
        .from("staff_services")
        .insert(v.serviceIds.map((service_id) => ({ staff_id: id!, service_id, studio_id: ctx.studio.id })));
      if (linkErr) return { ok: false, error: humanizeError(linkErr) };
    }
    revalidate(ctx);
    return { ok: true, data: { id: id! } };
  });
}

/** Deletes a specialist without history; archives one with appointments (keeps records, hides everywhere). */
export async function deleteStaff(id: string) {
  return withStudioAction(MANAGERS, async (ctx): Promise<ActionResult<{ archived: boolean }>> => {
    const now = new Date().toISOString();
    const { count: future } = await ctx.supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("staff_id", id)
      .in("status", ["pending", "confirmed"])
      .gte("start_at", now);
    if ((future ?? 0) > 0) {
      return { ok: false, error: `У специалиста ${future} предстоящих записей. Перенесите или отмените их, затем удалите.` };
    }
    const { count } = await ctx.supabase.from("appointments").select("id", { count: "exact", head: true }).eq("staff_id", id);
    if ((count ?? 0) > 0) {
      const { error } = await ctx.supabase
        .from("staff")
        .update({ archived_at: now, is_active: false })
        .eq("id", id)
        .eq("studio_id", ctx.studio.id);
      if (error) return { ok: false, error: humanizeError(error) };
      await ctx.supabase.from("staff_services").delete().eq("staff_id", id);
      revalidate(ctx);
      return { ok: true, data: { archived: true } };
    }
    const { error } = await ctx.supabase.from("staff").delete().eq("id", id).eq("studio_id", ctx.studio.id);
    if (error) return { ok: false, error: humanizeError(error) };
    revalidate(ctx);
    return { ok: true, data: { archived: false } };
  });
}
