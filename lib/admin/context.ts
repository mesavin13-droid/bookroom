import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_STUDIO_COOKIE } from "@/lib/config";
import { humanizeError } from "@/lib/booking/errors";
import type { ActionResult, Studio, StudioRole } from "@/types";

export type AdminStudio = Pick<Studio, "id" | "slug" | "name" | "timezone" | "currency" | "logo_url" | "is_published" | "vertical" | "suspended_at" | "suspend_reason">;

export interface AdminContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
  role: StudioRole;
  staffId: string | null;
  studio: AdminStudio;
  memberships: { role: StudioRole; studio: AdminStudio }[];
}

async function loadContext(): Promise<AdminContext | "anonymous" | "no-studio"> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "anonymous";

  const { data, error } = await supabase
    .from("studio_members")
    .select("role, staff_id, studio:studios(id, slug, name, timezone, currency, logo_url, is_published, vertical, suspended_at, suspend_reason)")
    .eq("profile_id", user.id)
    .order("created_at");
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as { studio: unknown }[]).filter((m) => m.studio) as unknown as {
    role: StudioRole;
    staff_id: string | null;
    studio: AdminStudio;
  }[];
  if (!rows.length) return "no-studio";

  const preferred = (await cookies()).get(ADMIN_STUDIO_COOKIE)?.value;
  const current = rows.find((m) => m.studio.id === preferred) ?? rows[0]!;
  return {
    supabase,
    user,
    role: current.role,
    staffId: current.staff_id,
    studio: current.studio,
    memberships: rows.map((r) => ({ role: r.role, studio: r.studio })),
  };
}

/** For pages/layouts: redirects when unauthenticated or without a studio. */
export const getAdminContext = cache(async (): Promise<AdminContext> => {
  const ctx = await loadContext();
  if (ctx === "anonymous") redirect("/login?next=/admin");
  if (ctx === "no-studio") redirect("/admin/onboarding");
  return ctx;
});

export function isManager(role: StudioRole) {
  return role === "owner" || role === "admin";
}

/** For pages that only managers may open. */
export async function requireManagerPage() {
  const ctx = await getAdminContext();
  if (!isManager(ctx.role)) redirect("/admin/calendar");
  return ctx;
}

class ActionDenied extends Error {}

/**
 * Wraps a server action: authenticates, checks the studio role, and turns any
 * thrown error into a human message. RLS still enforces access in the database.
 */
export async function withStudioAction<T>(
  roles: StudioRole[],
  fn: (ctx: AdminContext) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    const ctx = await loadContext();
    if (ctx === "anonymous") return { ok: false, error: "Сессия истекла. Войдите снова.", code: "AUTH_REQUIRED" };
    if (ctx === "no-studio") return { ok: false, error: "У вас нет доступа к студии.", code: "FORBIDDEN" };
    if (!roles.includes(ctx.role)) throw new ActionDenied();
    return await fn(ctx);
  } catch (err) {
    if (err instanceof ActionDenied) return { ok: false, error: "Недостаточно прав для этого действия.", code: "FORBIDDEN" };
    console.error("[admin action]", err);
    return { ok: false, error: humanizeError(err) };
  }
}

export const MANAGERS: StudioRole[] = ["owner", "admin"];
export const ALL_ROLES: StudioRole[] = ["owner", "admin", "staff"];
