"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { humanizeError } from "@/lib/booking/errors";
import type { ActionResult } from "@/types";

const schema = z.object({
  id: z.string().uuid(),
  action: z.enum(["suspend", "restore", "unpublish"]),
  reason: z.string().trim().max(300).optional(),
});

export async function setStudioStatus(input: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Проверьте данные." };
  if (parsed.data.action === "suspend" && !parsed.data.reason) return { ok: false, error: humanizeError({ message: "REASON_REQUIRED" }) };
  const supabase = await createClient();
  const { data: slug } = await supabase.rpc("platform_studio", { p_id: parsed.data.id });
  const { error } = await supabase.rpc("platform_set_studio_status", {
    p_id: parsed.data.id,
    p_action: parsed.data.action,
    p_reason: parsed.data.reason ?? null,
  });
  if (error) return { ok: false, error: humanizeError(error) };
  const s = (slug as { studio?: { slug?: string } } | null)?.studio?.slug;
  if (s) revalidatePath(`/s/${s}`, "layout");
  revalidatePath("/platform", "layout");
  revalidatePath("/");
  return { ok: true };
}
