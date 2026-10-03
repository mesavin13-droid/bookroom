-- BOOKROOM: core schema
-- Multi-studio booking platform. Every studio-owned row carries studio_id for RLS.

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.studio_role as enum ('owner', 'admin', 'staff');
create type public.appointment_status as enum ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
create type public.appointment_source as enum ('online', 'admin');
create type public.day_off_kind as enum ('day_off', 'vacation', 'sick_leave');
create type public.review_status as enum ('pending', 'published', 'hidden');
create type public.client_status as enum ('active', 'vip', 'blocked');
create type public.notification_type as enum (
  'booking_created', 'booking_confirmed', 'booking_cancelled', 'booking_rescheduled', 'booking_reminder'
);
create type public.notification_audience as enum ('studio', 'client');
create type public.notification_channel as enum ('in_app', 'email', 'sms', 'telegram');
create type public.delivery_status as enum ('pending', 'sent', 'failed', 'skipped');
create type public.media_kind as enum ('logo', 'cover', 'gallery', 'staff', 'review');

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  phone text,
  email text,
  avatar_url text,
  telegram_user_id bigint unique,
  telegram_username text,
  notify_email boolean not null default true,
  notify_sms boolean not null default false,
  notify_telegram boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Studios
-- ---------------------------------------------------------------------------
create table public.studios (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$'),
  name text not null check (char_length(name) between 2 and 80),
  kind text check (char_length(kind) <= 80),
  tagline text check (char_length(tagline) <= 160),
  description text check (char_length(description) <= 4000),
  address text,
  city text,
  latitude double precision,
  longitude double precision,
  phone text,
  email text,
  website text,
  telegram text,
  vk text,
  instagram text,
  logo_url text,
  cover_url text,
  timezone text not null default 'Europe/Moscow',
  currency text not null default 'RUB',
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger studios_updated_at before update on public.studios
  for each row execute function public.set_updated_at();

create table public.studio_settings (
  studio_id uuid primary key references public.studios (id) on delete cascade,
  min_notice_minutes integer not null default 120 check (min_notice_minutes between 0 and 10080),
  max_advance_days integer not null default 30 check (max_advance_days between 1 and 180),
  cancel_notice_minutes integer not null default 180 check (cancel_notice_minutes between 0 and 10080),
  allow_reschedule boolean not null default true,
  auto_confirm boolean not null default true,
  slot_step_minutes integer not null default 30 check (slot_step_minutes in (10, 15, 20, 30, 60)),
  notification_channels public.notification_channel[] not null default array['in_app']::public.notification_channel[],
  updated_at timestamptz not null default now()
);
create trigger studio_settings_updated_at before update on public.studio_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Catalog: categories, services, staff
-- ---------------------------------------------------------------------------
create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (studio_id, name)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  category_id uuid references public.service_categories (id) on delete set null,
  name text not null check (char_length(name) between 2 and 100),
  description text check (char_length(description) <= 1000),
  price numeric(12, 2) not null check (price >= 0),
  duration_minutes integer not null check (duration_minutes between 5 and 720),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_studio_idx on public.services (studio_id) where archived_at is null;
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(name) between 2 and 80),
  position text check (char_length(position) <= 80),
  bio text check (char_length(bio) <= 1000),
  photo_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index staff_studio_idx on public.staff (studio_id) where archived_at is null;
create trigger staff_updated_at before update on public.staff
  for each row execute function public.set_updated_at();

create table public.studio_members (
  studio_id uuid not null references public.studios (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.studio_role not null default 'staff',
  staff_id uuid references public.staff (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (studio_id, profile_id)
);
create index studio_members_profile_idx on public.studio_members (profile_id);

create table public.staff_services (
  staff_id uuid not null references public.staff (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  studio_id uuid not null references public.studios (id) on delete cascade,
  primary key (staff_id, service_id)
);
create index staff_services_service_idx on public.staff_services (service_id);

-- ---------------------------------------------------------------------------
-- Schedules (weekday: ISO 1 = Monday ... 7 = Sunday, local studio time)
-- ---------------------------------------------------------------------------
create table public.staff_schedules (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  is_working boolean not null default true,
  start_time time not null default '10:00',
  end_time time not null default '19:00',
  unique (staff_id, weekday),
  check (end_time > start_time)
);

create table public.schedule_breaks (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index schedule_breaks_staff_idx on public.schedule_breaks (staff_id, weekday);

create table public.days_off (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  kind public.day_off_kind not null default 'day_off',
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index days_off_staff_idx on public.days_off (staff_id, start_date, end_date);

-- ---------------------------------------------------------------------------
-- Clients (per studio; optionally linked to an auth profile)
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  phone text not null check (phone ~ '^\+[0-9]{10,15}$'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  notes text check (char_length(notes) <= 2000),
  status public.client_status not null default 'active',
  telegram_user_id bigint,
  telegram_username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, phone)
);
create index clients_profile_idx on public.clients (profile_id);
create index clients_studio_created_idx on public.clients (studio_id, created_at desc);
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Appointments. Double booking is impossible at the database level:
-- the exclusion constraint forbids overlapping active ranges for one specialist.
-- ---------------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  staff_id uuid not null references public.staff (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  price numeric(12, 2) not null check (price >= 0),
  status public.appointment_status not null default 'pending',
  source public.appointment_source not null default 'online',
  notes text check (char_length(notes) <= 1000),
  manage_token uuid not null unique default gen_random_uuid(),
  cancelled_at timestamptz,
  cancel_reason text check (char_length(cancel_reason) <= 300),
  reminder_sent_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  constraint appointments_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  ) where (status in ('pending', 'confirmed', 'completed'))
);
create index appointments_studio_start_idx on public.appointments (studio_id, start_at);
create index appointments_staff_start_idx on public.appointments (staff_id, start_at);
create index appointments_client_idx on public.appointments (client_id, start_at desc);
create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  appointment_id uuid unique references public.appointments (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  staff_id uuid references public.staff (id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  author_name text not null check (char_length(author_name) between 1 and 80),
  photo_url text,
  status public.review_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reviews_studio_idx on public.reviews (studio_id, status, created_at desc);
create trigger reviews_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Notifications (in-app now; deliveries table is the outbox for email/SMS/Telegram)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  audience public.notification_audience not null,
  recipient_profile_id uuid references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  appointment_id uuid references public.appointments (id) on delete cascade,
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (audience = 'studio' or recipient_profile_id is not null)
);
create index notifications_studio_idx on public.notifications (studio_id, audience, created_at desc);
create index notifications_recipient_idx on public.notifications (recipient_profile_id, created_at desc);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  channel public.notification_channel not null,
  status public.delivery_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index notification_deliveries_pending_idx on public.notification_deliveries (channel, created_at)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- Media (gallery, logos, covers)
-- ---------------------------------------------------------------------------
create table public.media (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios (id) on delete cascade,
  kind public.media_kind not null default 'gallery',
  url text not null,
  storage_path text,
  alt text check (char_length(alt) <= 200),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index media_studio_idx on public.media (studio_id, kind, sort_order);

-- ---------------------------------------------------------------------------
-- Cross-studio integrity: child rows must reference entities of the same studio.
-- ---------------------------------------------------------------------------
create or replace function public.tg_appointment_integrity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.clients where id = new.client_id and studio_id = new.studio_id)
     or not exists (select 1 from public.staff where id = new.staff_id and studio_id = new.studio_id)
     or not exists (select 1 from public.services where id = new.service_id and studio_id = new.studio_id) then
    raise exception 'CROSS_STUDIO_REFERENCE' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger appointments_integrity before insert or update of client_id, staff_id, service_id, studio_id
  on public.appointments for each row execute function public.tg_appointment_integrity();

create or replace function public.tg_staff_child_integrity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.staff where id = new.staff_id and studio_id = new.studio_id) then
    raise exception 'CROSS_STUDIO_REFERENCE' using errcode = '23514';
  end if;
  if tg_table_name = 'staff_services'
     and not exists (select 1 from public.services where id = new.service_id and studio_id = new.studio_id) then
    raise exception 'CROSS_STUDIO_REFERENCE' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger staff_services_integrity before insert or update on public.staff_services
  for each row execute function public.tg_staff_child_integrity();
create trigger staff_schedules_integrity before insert or update on public.staff_schedules
  for each row execute function public.tg_staff_child_integrity();
create trigger schedule_breaks_integrity before insert or update on public.schedule_breaks
  for each row execute function public.tg_staff_child_integrity();
create trigger days_off_integrity before insert or update on public.days_off
  for each row execute function public.tg_staff_child_integrity();

create or replace function public.tg_service_category_integrity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.category_id is not null
     and not exists (select 1 from public.service_categories where id = new.category_id and studio_id = new.studio_id) then
    raise exception 'CROSS_STUDIO_REFERENCE' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger services_category_integrity before insert or update of category_id on public.services
  for each row execute function public.tg_service_category_integrity();

-- ---------------------------------------------------------------------------
-- Aggregated client stats. security_invoker => RLS of the caller applies.
-- ---------------------------------------------------------------------------
create view public.client_stats with (security_invoker = true) as
select
  c.id as client_id,
  c.studio_id,
  count(a.id) filter (where a.status = 'completed')::int as visits,
  count(a.id)::int as total_appointments,
  max(a.start_at) filter (where a.status <> 'cancelled') as last_appointment_at,
  coalesce(sum(a.price) filter (where a.status = 'completed'), 0)::numeric(12, 2) as total_spent
from public.clients c
left join public.appointments a on a.client_id = c.id
group by c.id, c.studio_id;
