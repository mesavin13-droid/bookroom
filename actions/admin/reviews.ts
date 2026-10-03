"use server";

import { revalidatePath } from "next/cache";
import { MANAGERS, withStudioAction } from "@/lib/admin/context";
import { humanizeError } from "@/lib/booking/errors";
import type { ActionResult, ReviewStatus } from "@/types";

export async function setReviewStatus(id: string, status: ReviewStatus) {
  return withStudioAction(MANAGERS, async (ctx): Promise<ActionResult> => {
    if (!["pending", "published", "hidden"].includes(status)) return { ok: false, error: "Некорректный статус." };
    const { error } = await ctx.supabase.from("reviews").update({ status }).eq("id", id).eq("studio_id", ctx.studio.id);
    if (error) return { ok: false, error: humanizeError(error) };
    revalidatePath("/admin/reviews");
    revalidatePath(`/s/${ctx.studio.slug}`, "layout");
    return { ok: true };
  });
}

export async function deleteReview(id: string) {
  return withStudioAction(MANAGERS, async (ctx): Promise<ActionResult> => {
    const { error } = await ctx.supabase.from("reviews").delete().eq("id", id).eq("studio_id", ctx.studio.id);
    if (error) return { ok: false, error: humanizeError(error) };
    revalidatePath("/admin/reviews");
    revalidatePath(`/s/${ctx.studio.slug}`, "layout");
    return { ok: true };
  });
}
