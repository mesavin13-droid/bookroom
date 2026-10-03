"use server";

import { revalidatePath } from "next/cache";
import { MANAGERS, withStudioAction, type AdminContext } from "@/lib/admin/context";
import { categorySchema, fieldErrorsFrom, serviceSchema } from "@/lib/validations";
import { humanizeError } from "@/lib/booking/errors";
import type { ActionResult } from "@/types";

function revalidate(ctx: AdminContext) {
  revalidatePath("/admin/services");
  revalidatePath("/admin/staff", "layout");
  revalidatePath(`/s/${ctx.studio.slug}`, "layout");
}

export async function saveService(input: unknown) {
  return withStudioAction(MANAGERS, async (ctx): Promise<ActionResult<{ id: string }>> => {
    const parsed = serviceSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Проверьте поля.", fieldErrors: fieldErrorsFrom(parsed.error) };
    const v = parsed.data;
    const row = {
      studio_id: ctx.studio.id,
      name: v.name,
      description: v.description || null,
      category_id: v.categoryId || null,
      price: v.price,
      duration_minutes: v.durationDays ? 480 : v.durationMinutes,
      duration_days: v.durationDays,
      price_from: v.priceFrom,
      is_active: v.isActive,
    };
    let id = v.id;
    if (id) {
      const { error } = await ctx.supabase.from("services").update(row).eq("id", id).eq("studio_id", ctx.studio.id);
      if (error) return { ok: false, error: humanizeError(error) };
    } else {
      const { data: last } = await ctx.supabase
        .from("services")
        .select("sort_order")
        .eq("studio_id", ctx.studio.id)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data, error } = await ctx.supabase
        .from("services")
        .insert({ ...row, sort_order: (last?.sort_order ?? 0) + 1 })
        .select("id")
        .single();
      if (error) return { ok: false, error: humanizeError(error) };
      id = data.id as string;
    }
    // Sync specialists
    const { error: delErr } = await ctx.supabase.from("staff_services").delete().eq("service_id", id).eq("studio_id", ctx.studio.id);
    if (delErr) return { ok: false, error: humanizeError(delErr) };
    if (v.staffIds.length) {
      const { error: linkErr } = await ctx.supabase
        .from("staff_services")
        .insert(v.staffIds.map((staff_id) => ({ staff_id, service_id: id!, studio_id: ctx.studio.id })));
      if (linkErr) return { ok: false, error: humanizeError(linkErr) };
    }
    revalidate(ctx);
    return { ok: true, data: { id: id! } };
  });
}

export async function setServiceActive(id: string, isActive: boolean) {
  return withStudioAction(MANAGERS, async (ctx): Promise<ActionResult> => {
    const { error } = await ctx.supabase.from("services").update({ is_active: isActive }).eq("id", id).eq("studio_id", ctx.studio.id);
    if (error) return { ok: false, error: humanizeError(error) };
    revalidate(ctx);
    return { ok: true };
  });
}

/** Hard-deletes unused services; services with history are archived to keep records intact. */
export async function deleteService(id: string) {
  return withStudioAction(MANAGERS, async (ctx): Promise<ActionResult<{ archived: boolean }>> => {
    const { count } = await ctx.supabase.from("appointments").select("id", { count: "exact", head: true }).eq("service_id", id);
    if ((count ?? 0) > 0) {
      const { error } = await ctx.supabase
        .from("services")
        .update({ archived_at: new Date().toISOString(), is_active: false })
        .eq("id", id)
        .eq("studio_id", ctx.studio.id);
      if (error) return { ok: false, error: humanizeError(error) };
      await ctx.supabase.from("staff_services").delete().eq("service_id", id);
      revalidate(ctx);
      return { ok: true, data: { archived: true } };
    }
    const { error } = await ctx.supabase.from("services").delete().eq("id", id).eq("studio_id", ctx.studio.id);
    if (error) return { ok: false, error: humanizeError(error) };
    revalidate(ctx);
    return { ok: true, data: { archived: false } };
  });
}

export async function saveCategory(input: unknown) {
  return withStudioAction(MANAGERS, async (ctx): Promise<ActionResult> => {
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте название." };
    const { id, name } = parsed.data;
    let error;
    if (id) {
      ({ error } = await ctx.supabase.from("service_categories").update({ name }).eq("id", id).eq("studio_id", ctx.studio.id));
    } else {
      const { count } = await ctx.supabase.from("service_categories").select("id", { count: "exact", head: true }).eq("studio_id", ctx.studio.id);
      ({ error } = await ctx.supabase.from("service_categories").insert({ studio_id: ctx.studio.id, name, sort_order: (count ?? 0) + 1 }));
    }
    if (error) return { ok: false, error: error.code === "23505" ? "Такая категория уже есть." : humanizeError(error) };
    revalidate(ctx);
    return { ok: true };
  });
}

export async function deleteCategory(id: string) {
  return withStudioAction(MANAGERS, async (ctx): Promise<ActionResult> => {
    const { error } = await ctx.supabase.from("service_categories").delete().eq("id", id).eq("studio_id", ctx.studio.id);
    if (error) return { ok: false, error: humanizeError(error) };
    revalidate(ctx);
    return { ok: true };
  });
}
