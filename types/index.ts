export type StudioRole = "owner" | "admin" | "staff";
export type StudioVertical = "beauty" | "auto";
export type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
export type ReviewStatus = "pending" | "published" | "hidden";
export type ClientStatus = "active" | "vip" | "blocked";
export type DayOffKind = "day_off" | "vacation" | "sick_leave";
export type NotificationType =
  | "booking_created"
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "booking_reminder";

export interface Studio {
  id: string;
  slug: string;
  name: string;
  kind: string | null;
  tagline: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  telegram: string | null;
  vk: string | null;
  instagram: string | null;
  logo_url: string | null;
  cover_url: string | null;
  timezone: string;
  currency: string;
  is_published: boolean;
  vertical: StudioVertical;
  suspended_at?: string | null;
  suspend_reason?: string | null;
}

export interface StudioSettings {
  studio_id: string;
  min_notice_minutes: number;
  max_advance_days: number;
  cancel_notice_minutes: number;
  allow_reschedule: boolean;
  auto_confirm: boolean;
  slot_step_minutes: number;
  notification_channels: string[];
}

export interface ServiceCategory {
  id: string;
  studio_id: string;
  name: string;
  sort_order: number;
}

export interface Service {
  id: string;
  studio_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  duration_days: number | null;
  price_from: boolean;
  is_active: boolean;
  sort_order: number;
  archived_at: string | null;
}

export interface Staff {
  id: string;
  studio_id: string;
  profile_id: string | null;
  name: string;
  position: string | null;
  bio: string | null;
  photo_url: string | null;
  is_active: boolean;
  sort_order: number;
  archived_at: string | null;
}

export interface StaffSchedule {
  id: string;
  staff_id: string;
  weekday: number;
  is_working: boolean;
  start_time: string;
  end_time: string;
}

export interface ScheduleBreak {
  id: string;
  staff_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface DayOff {
  id: string;
  staff_id: string;
  start_date: string;
  end_date: string;
  kind: DayOffKind;
  reason: string | null;
}

export interface Client {
  id: string;
  studio_id: string;
  profile_id: string | null;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  status: ClientStatus;
  created_at: string;
}

export interface Appointment {
  id: string;
  studio_id: string;
  client_id: string;
  staff_id: string;
  service_id: string;
  start_at: string;
  end_at: string;
  price: number;
  status: AppointmentStatus;
  source: "online" | "admin";
  notes: string | null;
  manage_token: string;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  studio_id: string;
  appointment_id: string | null;
  staff_id: string | null;
  rating: number;
  comment: string | null;
  author_name: string;
  photo_url: string | null;
  status: ReviewStatus;
  created_at: string;
}

export interface Media {
  id: string;
  studio_id: string;
  kind: "logo" | "cover" | "gallery" | "staff" | "review";
  url: string;
  storage_path: string | null;
  alt: string | null;
  sort_order: number;
}

export interface Notification {
  id: string;
  studio_id: string;
  audience: "studio" | "client";
  type: NotificationType;
  appointment_id: string | null;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  telegram_user_id: number | null;
  telegram_username: string | null;
  notify_email: boolean;
  notify_sms: boolean;
  notify_telegram: boolean;
}

export interface BookingDetails {
  id: string;
  token: string;
  status: AppointmentStatus;
  start_at: string;
  end_at: string;
  price: number;
  notes: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  client_name: string;
  client_phone: string;
  client_email: string | null;
  has_account: boolean;
  studio: Pick<Studio, "id" | "slug" | "name" | "address" | "phone" | "timezone" | "currency" | "latitude" | "longitude" | "vertical">;
  service: Pick<Service, "id" | "name" | "duration_minutes" | "duration_days" | "price_from">;
  staff: Pick<Staff, "id" | "name" | "position" | "photo_url">;
  can_cancel: boolean;
  can_reschedule: boolean;
  cancel_notice_minutes: number;
  can_review: boolean;
  has_review: boolean;
}

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };
