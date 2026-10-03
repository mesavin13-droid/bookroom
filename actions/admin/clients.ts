"use server";

import { revalidatePath } from "next/cache";
import { MANAGERS, withStudioAction } from "@/lib/admin/context";
import { clientSchema, fieldErrorsFrom } from "@/lib/validations";
import { normalizePhone } from "@/lib/phone";
import { humanizeError } from "@/lib/booking/errors";
import type { ActionResult } from "@/types";

export async function saveClient(input: unknown) {
  return withStudioAction(MANAGERS, async (ctx): Promise<ActionResult<{ id: string }>> => {
    const parsed = clientSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Проверьте поля.", fieldErrors: fieldErrorsFrom(parsed.error) };
    const v = parsed.data;
    const row = {
      studio_id: ctx.studio.id,
      name: v.name,
      phone: normalizePhone(v.phone)!,
      email: v.email ? v.email.toLowerCase() : null,
      notes: v.notes || null,
      status: v.status,
    };
    const res = v.id
      ? await ctx.supabase.from("clients").update(row).eq("id", v.id).eq("studio_id", ctx.studio.id).select("id").single()
      : await ctx.supabase.from("clients").insert(row).select("id").single();
    if (res.error) {
      if (res.error.code === "23505") return { ok: false, error: "Клиент с таким телефоном уже есть.", fieldErrors: { phone: "Номер уже в базе" } };
      return { ok: false, error: humanizeError(res.error) };
    }
    revalidatePath("/admin/clients", "layout");
    return { ok: true, data: { id: res.data.id as string } };
  });
}

export async function deleteClient(id: string) {
  return withStudioAction(MANAGERS, async (ctx): Promise<ActionResult> => {
    const { count } = await ctx.supabase.from("appointments").select("id", { count: "exact", head: true }).eq("client_id", id);
    if ((count ?? 0) > 0) return { ok: false, error: "У клиента есть записи. Поставьте статус «Заблокирован» вместо удаления." };
    const { error } = await ctx.supabase.from("clients").delete().eq("id", id).eq("studio_id", ctx.studio.id);
    if (error) return { ok: false, error: humanizeError(error) };
    revalidatePath("/admin/clients", "layout");
    return { ok: true };
  });
}
