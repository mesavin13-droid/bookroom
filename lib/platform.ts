import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { StudioVertical } from "@/types";

/** Gate for /platform: signed in AND listed in platform_admins. Others get a 404. */
export const requirePlatformAdmin = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/platform");
  const { data } = await supabase.rpc("is_platform_admin");
  if (data !== true) notFound();
  return { supabase, user };
});

export interface PlatformOverview {
  studios_total: number;
  studios_live: number;
  studios_draft: number;
  studios_suspended: number;
  studios_new_7d: number;
  owners_total: number;
  clients_total: number;
  appointments_30d: number;
  appointments_upcoming: number;
  revenue_30d: number;
  daily: { day: string; bookings: number; studios: number }[];
}

export interface PlatformStudioRow {
  id: string;
  slug: string;
  name: string;
  vertical: StudioVertical;
  kind: string | null;
  city: string | null;
  logo_url: string | null;
  is_published: boolean;
  suspended_at: string | null;
  created_at: string;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  services: number;
  bookings_30d: number;
  last_booking_at: string | null;
}

export interface PlatformStudioDetail {
  studio: {
    id: string;
    slug: string;
    name: string;
    kind: string | null;
    vertical: StudioVertical;
    city: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    logo_url: string | null;
    timezone: string;
    currency: string;
    is_published: boolean;
    suspended_at: string | null;
    suspend_reason: string | null;
    created_at: string;
  };
  members: { role: string; name: string | null; email: string | null; phone: string | null; since: string }[];
  counts: { services: number; staff: number; clients: number; appointments: number; appointments_30d: number; revenue_30d: number; reviews: number; photos: number };
  recent: { id: string; start_at: string; status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show"; price: number; service: string | null }[];
  audit: { action: string; reason: string | null; at: string; actor: string | null; actor_email: string | null }[];
}

export type StudioState = "live" | "draft" | "suspended";
export function studioState(s: { is_published: boolean; suspended_at: string | null }): StudioState {
  return s.suspended_at ? "suspended" : s.is_published ? "live" : "draft";
}
export const STATE_LABEL: Record<StudioState, string> = { live: "Работает", draft: "Черновик", suspended: "Заблокирована" };
export const AUDIT_LABEL: Record<string, string> = { suspend: "Заблокирована", restore: "Разблокирована", unpublish: "Снята с публикации" };
