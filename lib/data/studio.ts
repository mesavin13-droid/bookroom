import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { hhmm } from "@/lib/datetime";
import type { Media, Review, Service, ServiceCategory, Staff, StaffSchedule, Studio, StudioSettings } from "@/types";

export type StaffWithServices = Staff & { serviceIds: string[] };

export interface OpeningHours {
  weekday: number;
  open: string | null;
  close: string | null;
}

export interface StudioPageData {
  studio: Studio;
  settings: StudioSettings;
  categories: ServiceCategory[];
  services: Service[];
  staff: StaffWithServices[];
  gallery: Media[];
  reviews: Review[];
  rating: { average: number; count: number };
  hours: OpeningHours[];
}

export const getStudio = cache(async (slug: string): Promise<Studio | null> => {
  if (!/^[a-z0-9-]{3,48}$/.test(slug)) return null;
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("studios").select("*").eq("slug", slug).eq("is_published", true).maybeSingle();
  if (error) throw new Error(`studio load failed: ${error.message}`);
  return (data as Studio | null) ?? null;
});

export function computeOpeningHours(schedules: Pick<StaffSchedule, "weekday" | "is_working" | "start_time" | "end_time">[]) {
  const out: OpeningHours[] = [];
  for (let wd = 1; wd <= 7; wd++) {
    const working = schedules.filter((s) => s.weekday === wd && s.is_working);
    if (!working.length) {
      out.push({ weekday: wd, open: null, close: null });
      continue;
    }
    const open = working.map((s) => hhmm(s.start_time)).sort()[0]!;
    const close = working.map((s) => hhmm(s.end_time)).sort().at(-1)!;
    out.push({ weekday: wd, open, close });
  }
  return out;
}

export const getStudioPageData = cache(async (slug: string): Promise<StudioPageData | null> => {
  const studio = await getStudio(slug);
  if (!studio) return null;
  const supabase = createPublicClient();
  const id = studio.id;

  const [settings, categories, services, staff, links, schedules, gallery, reviews] = await Promise.all([
    supabase.from("studio_settings").select("*").eq("studio_id", id).single(),
    supabase.from("service_categories").select("*").eq("studio_id", id).order("sort_order"),
    supabase
      .from("services")
      .select("*")
      .eq("studio_id", id)
      .eq("is_active", true)
      .is("archived_at", null)
      .order("sort_order")
      .order("name"),
    supabase
      .from("staff")
      .select("*")
      .eq("studio_id", id)
      .eq("is_active", true)
      .is("archived_at", null)
      .order("sort_order")
      .order("name"),
    supabase.from("staff_services").select("staff_id, service_id").eq("studio_id", id),
    supabase.from("staff_schedules").select("staff_id, weekday, is_working, start_time, end_time").eq("studio_id", id),
    supabase.from("media").select("*").eq("studio_id", id).eq("kind", "gallery").order("sort_order"),
    supabase
      .from("reviews")
      .select("id, studio_id, appointment_id, staff_id, rating, comment, author_name, photo_url, status, created_at")
      .eq("studio_id", id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  for (const r of [settings, categories, services, staff, links, schedules, gallery, reviews]) {
    if (r.error) throw new Error(`studio data load failed: ${r.error.message}`);
  }

  const staffRows = (staff.data ?? []) as Staff[];
  const activeStaffIds = new Set(staffRows.map((s) => s.id));
  const linkRows = (links.data ?? []) as { staff_id: string; service_id: string }[];
  const staffWithServices = staffRows.map((s) => ({
    ...s,
    serviceIds: linkRows.filter((l) => l.staff_id === s.id).map((l) => l.service_id),
  }));
  const reviewRows = (reviews.data ?? []) as Review[];
  const avg = reviewRows.length ? reviewRows.reduce((a, r) => a + r.rating, 0) / reviewRows.length : 0;
  const scheduleRows = ((schedules.data ?? []) as (StaffSchedule & { staff_id: string })[]).filter((s) =>
    activeStaffIds.has(s.staff_id),
  );

  return {
    studio,
    settings: settings.data as StudioSettings,
    categories: (categories.data ?? []) as ServiceCategory[],
    services: ((services.data ?? []) as Service[]).map((s) => ({ ...s, price: Number(s.price) })),
    staff: staffWithServices,
    gallery: (gallery.data ?? []) as Media[],
    reviews: reviewRows,
    rating: { average: Math.round(avg * 10) / 10, count: reviewRows.length },
    hours: computeOpeningHours(scheduleRows),
  };
});

export async function listPublishedStudios() {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("studios")
    .select("id, slug, name, kind, tagline, address, cover_url, vertical")
    .eq("is_published", true)
    .order("created_at")
    .limit(24);
  if (error) throw new Error(error.message);
  return (data ?? []) as Pick<Studio, "id" | "slug" | "name" | "kind" | "tagline" | "address" | "cover_url" | "vertical">[];
}
