import "server-only";
import type { AdminContext } from "@/lib/admin/context";
import { addDaysKey, todayKey, zonedTimeToUtc } from "@/lib/datetime";
import type { AppointmentStatus, Service, ServiceCategory, Staff } from "@/types";

export interface AdminAppointment {
  id: string;
  start_at: string;
  end_at: string;
  price: number;
  status: AppointmentStatus;
  notes: string | null;
  source: "online" | "admin";
  staff_id: string;
  service_id: string;
  client_id: string;
  manage_token: string;
  created_at: string;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  client: { id: string; name: string; phone: string } | null;
  service: { id: string; name: string; duration_minutes: number; duration_days: number | null } | null;
  staff: { id: string; name: string; photo_url: string | null } | null;
}

export const APPOINTMENT_SELECT =
  "id, start_at, end_at, price, status, notes, source, staff_id, service_id, client_id, manage_token, created_at, vehicle_model, vehicle_plate, client:clients(id, name, phone), service:services(id, name, duration_minutes, duration_days), staff:staff(id, name, photo_url)";

export async function getCatalog(ctx: AdminContext) {
  const id = ctx.studio.id;
  const [services, staff, categories, links] = await Promise.all([
    ctx.supabase.from("services").select("*").eq("studio_id", id).is("archived_at", null).order("sort_order").order("name"),
    ctx.supabase.from("staff").select("*").eq("studio_id", id).is("archived_at", null).order("sort_order").order("name"),
    ctx.supabase.from("service_categories").select("*").eq("studio_id", id).order("sort_order"),
    ctx.supabase.from("staff_services").select("staff_id, service_id").eq("studio_id", id),
  ]);
  for (const r of [services, staff, categories, links]) if (r.error) throw new Error(r.error.message);
  return {
    services: ((services.data ?? []) as Service[]).map((s) => ({ ...s, price: Number(s.price) })),
    staff: (staff.data ?? []) as Staff[],
    categories: (categories.data ?? []) as ServiceCategory[],
    links: (links.data ?? []) as { staff_id: string; service_id: string }[],
  };
}

export async function getAppointmentsBetween(ctx: AdminContext, fromKey: string, toKeyExclusive: string, opts: { staffId?: string | null; includeCancelled?: boolean } = {}) {
  const tz = ctx.studio.timezone;
  let q = ctx.supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("studio_id", ctx.studio.id)
    .lt("start_at", zonedTimeToUtc(toKeyExclusive, "00:00", tz).toISOString())
    .gt("end_at", zonedTimeToUtc(fromKey, "00:00", tz).toISOString())
    .order("start_at");
  if (!opts.includeCancelled) q = q.not("status", "in", "(cancelled)");
  if (opts.staffId) q = q.eq("staff_id", opts.staffId);
  if (ctx.role === "staff" && ctx.staffId) q = q.eq("staff_id", ctx.staffId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as AdminAppointment[]).map((a) => ({ ...a, price: Number(a.price) }));
}

export function todayRange(ctx: AdminContext) {
  const today = todayKey(ctx.studio.timezone);
  return {
    today,
    from: zonedTimeToUtc(today, "00:00", ctx.studio.timezone).toISOString(),
    to: zonedTimeToUtc(addDaysKey(today, 1), "00:00", ctx.studio.timezone).toISOString(),
  };
}
