import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { loadAvailability } from "@/lib/booking/availability";
import type { Service, Studio } from "@/types";

/** Nearest bookable slot for the shortest service, for the studio page summary. */
export async function getNextAvailableSlot(studio: Studio, services: Service[]) {
  const service = [...services].sort((a, b) => a.duration_minutes - b.duration_minutes)[0];
  if (!service) return null;
  try {
    const res = await loadAvailability({
      supabase: createPublicClient(),
      studioId: studio.id,
      timezone: studio.timezone,
      serviceId: service.id,
      staffId: null,
      days: 14,
    });
    for (const day of res.days) {
      const slot = day.slots.find((s) => s.available);
      if (slot) return { date: day.date, time: slot.time, startAt: slot.startAt };
    }
    return null;
  } catch {
    return null;
  }
}
