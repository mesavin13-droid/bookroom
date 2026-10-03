import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus, Notification, Profile } from "@/types";

export interface AccountAppointment {
  id: string;
  start_at: string;
  end_at: string;
  price: number;
  status: AppointmentStatus;
  manage_token: string;
  studio: { name: string; slug: string; address: string | null; timezone: string; currency: string } | null;
  service: { id: string; name: string; duration_minutes: number } | null;
  staff: { name: string; photo_url: string | null } | null;
}

export async function getAccount() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return { supabase, user, profile: profile as Profile | null };
}

export async function getMyAppointments(scope: "upcoming" | "history" | "all" = "all") {
  const { supabase, user } = await getAccount();
  // Only the user's own client records: owners must not see their studio's bookings here.
  const { data: clients } = await supabase.from("clients").select("id").eq("profile_id", user.id);
  const ids = (clients ?? []).map((c: { id: string }) => c.id);
  if (!ids.length) return [];
  const now = new Date().toISOString();
  let q = supabase
    .from("appointments")
    .select(
      "id, start_at, end_at, price, status, manage_token, studio:studios(name, slug, address, timezone, currency), service:services(id, name, duration_minutes), staff:staff(name, photo_url)",
    )
    .in("client_id", ids);
  if (scope === "upcoming") q = q.gte("end_at", now).in("status", ["pending", "confirmed"]).order("start_at");
  else if (scope === "history")
    q = q.or(`end_at.lt."${now}",status.in.(cancelled,no_show,completed)`).order("start_at", { ascending: false }).limit(100);
  else q = q.order("start_at", { ascending: false });
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AccountAppointment[];
}

export async function getMyNotifications() {
  const { supabase, user } = await getAccount();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as Notification[];
}
