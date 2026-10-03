import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDaysKey, hhmm, todayKey, zonedTimeToUtc } from "@/lib/datetime";
import { computeRange, type DayAvailability, type StaffAvailabilityInput } from "@/lib/booking/slots";

export class AvailabilityError extends Error {
  constructor(public code: "STUDIO_NOT_FOUND" | "SERVICE_NOT_FOUND" | "STAFF_UNAVAILABLE" | "LOAD_FAILED", message?: string) {
    super(message ?? code);
  }
}

export interface AvailabilityResult {
  timezone: string;
  durationMinutes: number;
  durationDays?: number | null;
  from: string;
  days: DayAvailability[];
  staffIds: string[];
}

interface Params {
  supabase: SupabaseClient;
  studioId: string;
  timezone: string;
  serviceId: string;
  staffId: string | null;
  from?: string;
  days?: number;
  excludeToken?: string | null;
  /** Admin mode: ignore min notice / horizon (still respects schedules and bookings). */
  ignoreRules?: boolean;
  now?: Date;
}

export async function loadAvailability(p: Params): Promise<AvailabilityResult> {
  const { supabase, studioId, timezone } = p;
  const now = p.now ?? new Date();

  const [settingsRes, serviceRes, linksRes] = await Promise.all([
    supabase.from("studio_settings").select("*").eq("studio_id", studioId).single(),
    supabase
      .from("services")
      .select("id, duration_minutes, duration_days, is_active, archived_at")
      .eq("id", p.serviceId)
      .eq("studio_id", studioId)
      .maybeSingle(),
    supabase.from("staff_services").select("staff_id").eq("service_id", p.serviceId).eq("studio_id", studioId),
  ]);
  if (settingsRes.error || serviceRes.error || linksRes.error) throw new AvailabilityError("LOAD_FAILED");
  const service = serviceRes.data;
  if (!service || !service.is_active || service.archived_at) throw new AvailabilityError("SERVICE_NOT_FOUND");
  const settings = settingsRes.data;

  let staffIds: string[] = ((linksRes.data ?? []) as { staff_id: string }[]).map((l: { staff_id: string }) => l.staff_id);
  if (p.staffId) {
    if (!staffIds.includes(p.staffId)) throw new AvailabilityError("STAFF_UNAVAILABLE");
    staffIds = [p.staffId];
  }

  const staffRes = staffIds.length
    ? await supabase.from("staff").select("id").in("id", staffIds).eq("is_active", true).is("archived_at", null)
    : { data: [], error: null };
  if (staffRes.error) throw new AvailabilityError("LOAD_FAILED");
  staffIds = ((staffRes.data ?? []) as { id: string }[]).map((s) => s.id);
  if (p.staffId && !staffIds.length) throw new AvailabilityError("STAFF_UNAVAILABLE");

  const maxAdvanceDays = p.ignoreRules ? 120 : settings.max_advance_days;
  const today = todayKey(timezone, now);
  const from = p.from && p.from >= today ? p.from : today;
  const days = Math.min(p.days ?? maxAdvanceDays + 1, 62);

  if (!staffIds.length) {
    return { timezone, durationMinutes: service.duration_minutes, from, days: [], staffIds: [] };
  }

  const rangeFrom = zonedTimeToUtc(from, "00:00", timezone);
  // Multi-day jobs can extend past the visible range (and over weekends).
  const rangeTo = zonedTimeToUtc(addDaysKey(from, days + (service.duration_days ? 31 : 0)), "00:00", timezone);

  const [schedRes, breaksRes, dataRes] = await Promise.all([
    supabase.from("staff_schedules").select("staff_id, weekday, is_working, start_time, end_time").in("staff_id", staffIds),
    supabase.from("schedule_breaks").select("staff_id, weekday, start_time, end_time").in("staff_id", staffIds),
    supabase.rpc("get_availability_data", {
      p_studio_id: studioId,
      p_from: rangeFrom.toISOString(),
      p_to: rangeTo.toISOString(),
      p_exclude_token: p.excludeToken ?? null,
    }),
  ]);
  if (schedRes.error || breaksRes.error || dataRes.error) throw new AvailabilityError("LOAD_FAILED");

  const busy = (dataRes.data?.busy ?? []) as { staff_id: string; start_at: string; end_at: string }[];
  const daysOff = (dataRes.data?.days_off ?? []) as { staff_id: string; start_date: string; end_date: string }[];

  const inputs: StaffAvailabilityInput[] = staffIds.map((id) => ({
    staffId: id,
    hours: (schedRes.data ?? [])
      .filter((s: { staff_id: string }) => s.staff_id === id)
      .map((s: { weekday: number; is_working: boolean; start_time: string; end_time: string }) => ({
        weekday: s.weekday,
        isWorking: s.is_working,
        start: hhmm(s.start_time),
        end: hhmm(s.end_time),
      })),
    breaks: (breaksRes.data ?? [])
      .filter((b: { staff_id: string }) => b.staff_id === id)
      .map((b: { weekday: number; start_time: string; end_time: string }) => ({
        weekday: b.weekday,
        start: hhmm(b.start_time),
        end: hhmm(b.end_time),
      })),
    daysOff: daysOff.filter((d) => d.staff_id === id).map((d) => ({ startDate: d.start_date, endDate: d.end_date })),
    busy: busy.filter((b) => b.staff_id === id).map((b) => ({ start: new Date(b.start_at), end: new Date(b.end_at) })),
  }));

  const result = computeRange(inputs, from, days, {
    timeZone: timezone,
    durationMinutes: service.duration_minutes,
    stepMinutes: settings.slot_step_minutes,
    minNoticeMinutes: p.ignoreRules ? 0 : settings.min_notice_minutes,
    maxAdvanceDays,
    now,
    durationDays: service.duration_days,
  });

  return { timezone, durationMinutes: service.duration_minutes, durationDays: service.duration_days, from, days: result, staffIds };
}
