-- BOOKROOM: helper functions, booking RPCs, notification triggers.
-- All functions that bypass RLS are SECURITY DEFINER with an empty search_path
-- and validate everything themselves. Nothing here trusts the caller.

-- ---------------------------------------------------------------------------
-- Utilities
-- ---------------------------------------------------------------------------
create or replace function public.normalize_phone(p text)
returns text language sql immutable as $$
  select case
    when d is null or length(d) < 10 or length(d) > 15 then null
    when length(d) = 10 then '+7' || d
    when length(d) = 11 and left(d, 1) = '8' then '+7' || substr(d, 2)
    else '+' || d
  end
  from (select nullif(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '') as d) s
$$;

create or replace function public.try_uuid(p text)
returns uuid language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- Membership helpers (used by RLS)
-- ---------------------------------------------------------------------------
create or replace function public.has_studio_role(
  p_studio uuid,
  p_roles public.studio_role[] default array['owner', 'admin']::public.studio_role[]
) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.studio_members m
    where m.studio_id = p_studio and m.profile_id = auth.uid() and m.role = any (p_roles)
  )
$$;

create or replace function public.is_studio_member(p_studio uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.studio_members m where m.studio_id = p_studio and m.profile_id = auth.uid())
$$;

create or replace function public.my_staff_id(p_studio uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select m.staff_id from public.studio_members m where m.studio_id = p_studio and m.profile_id = auth.uid()
$$;

create or replace function public.studio_is_public(p_studio uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select s.is_published from public.studios s where s.id = p_studio), false)
$$;

create or replace function public.is_my_client(p_client uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (select 1 from public.clients c where c.id = p_client and c.profile_id = auth.uid())
$$;

create or replace function public.staff_serves_client(p_client uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.appointments a
    join public.studio_members m on m.studio_id = a.studio_id and m.profile_id = auth.uid() and m.staff_id = a.staff_id
    where a.client_id = p_client
  )
$$;

-- ---------------------------------------------------------------------------
-- Auth: create a profile for every new auth user
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    lower(new.email),
    public.normalize_phone(new.phone)
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Links guest client records of this studio(s) to the signed-in user when the
-- user's *verified* phone or email matches. Called right after login.
create or replace function public.claim_my_clients()
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  v_email text;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  select
    case when u.phone_confirmed_at is not null then public.normalize_phone(u.phone) end,
    case when u.email_confirmed_at is not null then lower(u.email) end
  into v_phone, v_email
  from auth.users u where u.id = v_uid;

  update public.clients c
     set profile_id = v_uid
   where c.profile_id is null
     and ((v_phone is not null and c.phone = v_phone) or (v_email is not null and lower(c.email) = v_email));
  get diagnostics v_count = row_count;

  update public.profiles p
     set phone = coalesce(p.phone, v_phone), email = coalesce(p.email, v_email)
   where p.id = v_uid;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- Studio onboarding
-- ---------------------------------------------------------------------------
create or replace function public.tg_studio_defaults()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.studio_settings (studio_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger studios_defaults after insert on public.studios
  for each row execute function public.tg_studio_defaults();

create or replace function public.create_studio(p_name text, p_slug text, p_timezone text default 'Europe/Moscow')
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'INVALID_TIMEZONE';
  end if;
  if exists (select 1 from public.studios where slug = lower(p_slug)) then
    raise exception 'SLUG_TAKEN';
  end if;
  insert into public.studios (name, slug, timezone) values (trim(p_name), lower(p_slug), p_timezone) returning id into v_id;
  insert into public.studio_members (studio_id, profile_id, role) values (v_id, v_uid, 'owner');
  insert into public.service_categories (studio_id, name, sort_order)
  select v_id, x.name, x.ord from unnest(array['Стрижка', 'Борода', 'Комплекс', 'Окрашивание', 'Уход', 'Другое'])
    with ordinality as x(name, ord);
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Booking rules (internal)
-- ---------------------------------------------------------------------------
create or replace function public._assert_booking_window(
  p_tz text, p_settings public.studio_settings, p_start timestamptz
) returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_start < now() + make_interval(mins => p_settings.min_notice_minutes) then
    raise exception 'TOO_SOON';
  end if;
  if (p_start at time zone p_tz)::date > (now() at time zone p_tz)::date + p_settings.max_advance_days then
    raise exception 'TOO_FAR';
  end if;
end $$;

-- Checks that a specialist works and is free (schedule, breaks, days off) for
-- [p_start, p_start + duration). Overlap with other appointments is enforced by
-- the exclusion constraint at insert/update time.
create or replace function public._assert_staff_window(
  p_studio_id uuid, p_tz text, p_service_id uuid, p_duration integer, p_staff_id uuid, p_start timestamptz
) returns void language plpgsql stable security definer set search_path = '' as $$
declare
  v_local timestamp := p_start at time zone p_tz;
  v_local_end timestamp := (p_start + make_interval(mins => p_duration)) at time zone p_tz;
  v_dow integer := extract(isodow from (p_start at time zone p_tz))::integer;
  v_sched public.staff_schedules;
begin
  if not exists (
    select 1 from public.staff s
    join public.staff_services ss on ss.staff_id = s.id and ss.service_id = p_service_id
    where s.id = p_staff_id and s.studio_id = p_studio_id and s.is_active and s.archived_at is null
  ) then
    raise exception 'STAFF_UNAVAILABLE';
  end if;

  select * into v_sched from public.staff_schedules where staff_id = p_staff_id and weekday = v_dow;
  if not found or not v_sched.is_working
     or v_local_end::date <> v_local::date
     or v_local::time < v_sched.start_time
     or v_local_end::time > v_sched.end_time then
    raise exception 'SLOT_UNAVAILABLE';
  end if;

  if exists (
    select 1 from public.schedule_breaks b
    where b.staff_id = p_staff_id and b.weekday = v_dow
      and v_local::time < b.end_time and v_local_end::time > b.start_time
  ) then
    raise exception 'SLOT_UNAVAILABLE';
  end if;

  if exists (
    select 1 from public.days_off d
    where d.staff_id = p_staff_id and v_local::date between d.start_date and d.end_date
  ) then
    raise exception 'SLOT_UNAVAILABLE';
  end if;
end $$;

revoke all on function public._assert_booking_window(text, public.studio_settings, timestamptz) from public, anon, authenticated;
revoke all on function public._assert_staff_window(uuid, text, uuid, integer, uuid, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public availability data (busy intervals without any client data)
-- ---------------------------------------------------------------------------
create or replace function public.get_availability_data(
  p_studio_id uuid, p_from timestamptz, p_to timestamptz, p_exclude_token uuid default null
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.studio_is_public(p_studio_id) and not public.is_studio_member(p_studio_id) then
    raise exception 'STUDIO_NOT_FOUND';
  end if;
  if p_to <= p_from or p_to - p_from > interval '190 days' then
    raise exception 'INVALID_RANGE';
  end if;
  return jsonb_build_object(
    'busy', coalesce((
      select jsonb_agg(jsonb_build_object('staff_id', a.staff_id, 'start_at', a.start_at, 'end_at', a.end_at))
      from public.appointments a
      where a.studio_id = p_studio_id
        and a.status in ('pending', 'confirmed', 'completed')
        and a.start_at < p_to and a.end_at > p_from
        and (p_exclude_token is null or a.manage_token <> p_exclude_token)
    ), '[]'::jsonb),
    'days_off', coalesce((
      select jsonb_agg(jsonb_build_object('staff_id', d.staff_id, 'start_date', d.start_date, 'end_date', d.end_date))
      from public.days_off d
      where d.studio_id = p_studio_id
        and d.end_date >= (p_from at time zone 'UTC')::date - 1
        and d.start_date <= (p_to at time zone 'UTC')::date + 1
    ), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------------------
-- Online booking (guest or signed-in). The single trusted entry point.
-- p_staff_id = null means "any specialist".
-- ---------------------------------------------------------------------------
create or replace function public.book_appointment(
  p_studio_slug text,
  p_service_id uuid,
  p_staff_id uuid,
  p_start_at timestamptz,
  p_name text,
  p_phone text,
  p_email text default null,
  p_notes text default null
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_studio public.studios;
  v_settings public.studio_settings;
  v_service public.services;
  v_phone text := public.normalize_phone(p_phone);
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_name text := trim(coalesce(p_name, ''));
  v_uid uuid := auth.uid();
  v_client public.clients;
  v_appt public.appointments;
  v_candidate uuid;
  v_auth_phone text;
  v_auth_email text;
  v_day_start timestamptz;
begin
  if v_phone is null then raise exception 'INVALID_PHONE'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then raise exception 'INVALID_NAME'; end if;
  if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'INVALID_EMAIL'; end if;
  if char_length(coalesce(p_notes, '')) > 500 then raise exception 'INVALID_NOTES'; end if;

  select * into v_studio from public.studios where slug = lower(p_studio_slug) and is_published;
  if not found then raise exception 'STUDIO_NOT_FOUND'; end if;
  select * into v_settings from public.studio_settings where studio_id = v_studio.id;

  select * into v_service from public.services
   where id = p_service_id and studio_id = v_studio.id and is_active and archived_at is null;
  if not found then raise exception 'SERVICE_NOT_FOUND'; end if;

  perform public._assert_booking_window(v_studio.timezone, v_settings, p_start_at);

  insert into public.clients (studio_id, name, phone, email)
  values (v_studio.id, v_name, v_phone, v_email)
  on conflict (studio_id, phone) do update
    set email = coalesce(public.clients.email, excluded.email)
  returning * into v_client;

  if v_client.status = 'blocked' then raise exception 'CLIENT_BLOCKED'; end if;

  if v_uid is not null and v_client.profile_id is null then
    select
      case when u.phone_confirmed_at is not null then public.normalize_phone(u.phone) end,
      case when u.email_confirmed_at is not null then lower(u.email) end
    into v_auth_phone, v_auth_email
    from auth.users u where u.id = v_uid;
    if v_auth_phone = v_phone or (v_auth_email is not null and v_auth_email = v_email) then
      update public.clients set profile_id = v_uid where id = v_client.id;
    end if;
  end if;

  v_day_start := date_trunc('day', p_start_at at time zone v_studio.timezone) at time zone v_studio.timezone;

  for v_candidate in
    select s.id
    from public.staff s
    join public.staff_services ss on ss.staff_id = s.id and ss.service_id = v_service.id
    where s.studio_id = v_studio.id and s.is_active and s.archived_at is null
      and (p_staff_id is null or s.id = p_staff_id)
    order by (
      select count(*) from public.appointments a
      where a.staff_id = s.id and a.status in ('pending', 'confirmed')
        and a.start_at >= v_day_start and a.start_at < v_day_start + interval '1 day'
    ), s.sort_order, s.id
  loop
    begin
      perform public._assert_staff_window(v_studio.id, v_studio.timezone, v_service.id, v_service.duration_minutes, v_candidate, p_start_at);
      insert into public.appointments (
        studio_id, client_id, staff_id, service_id, start_at, end_at, price, status, source, notes, created_by
      ) values (
        v_studio.id, v_client.id, v_candidate, v_service.id, p_start_at,
        p_start_at + make_interval(mins => v_service.duration_minutes), v_service.price,
        case when v_settings.auto_confirm then 'confirmed'::public.appointment_status else 'pending'::public.appointment_status end,
        'online', nullif(trim(coalesce(p_notes, '')), ''), v_uid
      ) returning * into v_appt;
      exit;
    exception
      when exclusion_violation then
        if p_staff_id is not null then raise exception 'SLOT_TAKEN'; end if;
      when raise_exception then
        if p_staff_id is not null then raise; end if;
    end;
  end loop;

  if v_appt.id is null then
    if p_staff_id is not null then raise exception 'STAFF_UNAVAILABLE'; end if;
    raise exception 'SLOT_TAKEN';
  end if;

  return jsonb_build_object('id', v_appt.id, 'token', v_appt.manage_token, 'status', v_appt.status, 'staff_id', v_appt.staff_id);
end $$;

-- ---------------------------------------------------------------------------
-- Manage booking by secret token (confirmation page, cancel, reschedule)
-- ---------------------------------------------------------------------------
create or replace function public.get_booking_by_token(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
    'id', a.id,
    'token', a.manage_token,
    'status', a.status,
    'start_at', a.start_at,
    'end_at', a.end_at,
    'price', a.price,
    'notes', a.notes,
    'client_name', c.name,
    'client_phone', c.phone,
    'client_email', c.email,
    'has_account', c.profile_id is not null,
    'studio', jsonb_build_object('id', st.id, 'slug', st.slug, 'name', st.name, 'address', st.address,
      'phone', st.phone, 'timezone', st.timezone, 'currency', st.currency, 'latitude', st.latitude, 'longitude', st.longitude),
    'service', jsonb_build_object('id', sv.id, 'name', sv.name, 'duration_minutes', sv.duration_minutes),
    'staff', jsonb_build_object('id', sf.id, 'name', sf.name, 'position', sf.position, 'photo_url', sf.photo_url),
    'can_cancel', a.status in ('pending', 'confirmed') and a.start_at - make_interval(mins => ss.cancel_notice_minutes) > now(),
    'can_reschedule', ss.allow_reschedule and a.status in ('pending', 'confirmed') and a.start_at - make_interval(mins => ss.cancel_notice_minutes) > now(),
    'cancel_notice_minutes', ss.cancel_notice_minutes,
    'can_review', a.status = 'completed' and not exists (select 1 from public.reviews r where r.appointment_id = a.id),
    'has_review', exists (select 1 from public.reviews r where r.appointment_id = a.id)
  ) into v
  from public.appointments a
  join public.clients c on c.id = a.client_id
  join public.studios st on st.id = a.studio_id
  join public.services sv on sv.id = a.service_id
  join public.staff sf on sf.id = a.staff_id
  join public.studio_settings ss on ss.studio_id = a.studio_id
  where a.manage_token = p_token;
  return v;
end $$;

create or replace function public.cancel_booking_by_token(p_token uuid, p_reason text default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_appt public.appointments;
  v_settings public.studio_settings;
begin
  select * into v_appt from public.appointments where manage_token = p_token for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_appt.status not in ('pending', 'confirmed') then raise exception 'NOT_CANCELLABLE'; end if;
  select * into v_settings from public.studio_settings where studio_id = v_appt.studio_id;
  if v_appt.start_at - make_interval(mins => v_settings.cancel_notice_minutes) <= now() then
    raise exception 'CANCEL_TOO_LATE';
  end if;
  update public.appointments
     set status = 'cancelled', cancelled_at = now(), cancel_reason = left(nullif(trim(coalesce(p_reason, '')), ''), 300)
   where id = v_appt.id;
  return jsonb_build_object('id', v_appt.id, 'status', 'cancelled');
end $$;

create or replace function public.reschedule_booking_by_token(p_token uuid, p_start_at timestamptz)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_appt public.appointments;
  v_settings public.studio_settings;
  v_studio public.studios;
  v_service public.services;
begin
  select * into v_appt from public.appointments where manage_token = p_token for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_appt.status not in ('pending', 'confirmed') then raise exception 'NOT_RESCHEDULABLE'; end if;
  select * into v_settings from public.studio_settings where studio_id = v_appt.studio_id;
  if not v_settings.allow_reschedule then raise exception 'RESCHEDULE_DISABLED'; end if;
  if v_appt.start_at - make_interval(mins => v_settings.cancel_notice_minutes) <= now() then
    raise exception 'RESCHEDULE_TOO_LATE';
  end if;
  select * into v_studio from public.studios where id = v_appt.studio_id;
  select * into v_service from public.services where id = v_appt.service_id;

  perform public._assert_booking_window(v_studio.timezone, v_settings, p_start_at);
  perform public._assert_staff_window(v_studio.id, v_studio.timezone, v_service.id, v_service.duration_minutes, v_appt.staff_id, p_start_at);

  begin
    update public.appointments
       set start_at = p_start_at,
           end_at = p_start_at + make_interval(mins => v_service.duration_minutes),
           status = case when v_settings.auto_confirm then 'confirmed'::public.appointment_status else 'pending'::public.appointment_status end,
           reminder_sent_at = null
     where id = v_appt.id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN';
  end;
  return jsonb_build_object('id', v_appt.id, 'token', v_appt.manage_token);
end $$;

create or replace function public.submit_review(
  p_token uuid, p_rating integer, p_comment text, p_author_name text, p_photo_url text default null
) returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_appt public.appointments;
  v_id uuid;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'INVALID_RATING'; end if;
  if char_length(trim(coalesce(p_author_name, ''))) < 1 then raise exception 'INVALID_NAME'; end if;
  select * into v_appt from public.appointments where manage_token = p_token;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_appt.status <> 'completed' then raise exception 'REVIEW_NOT_ALLOWED'; end if;
  if p_photo_url is not null and p_photo_url !~ '^https?://' then raise exception 'INVALID_PHOTO'; end if;
  begin
    insert into public.reviews (studio_id, appointment_id, client_id, staff_id, rating, comment, author_name, photo_url, status)
    values (v_appt.studio_id, v_appt.id, v_appt.client_id, v_appt.staff_id, p_rating,
            left(nullif(trim(coalesce(p_comment, '')), ''), 2000), left(trim(p_author_name), 80), p_photo_url, 'pending')
    returning id into v_id;
  exception when unique_violation then
    raise exception 'REVIEW_EXISTS';
  end;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Notifications: generated by a trigger so every write path (online, admin,
-- token, future integrations) produces the same events.
-- ---------------------------------------------------------------------------
create or replace function public._enqueue_notification(
  p_appt public.appointments, p_type public.notification_type
) returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_service text;
  v_staff text;
  v_tz text;
  v_when text;
  v_title text;
  v_profile uuid;
  v_channels public.notification_channel[];
  v_id uuid;
  v_payload jsonb;
begin
  select s.name into v_service from public.services s where s.id = p_appt.service_id;
  select s.name into v_staff from public.staff s where s.id = p_appt.staff_id;
  select st.timezone into v_tz from public.studios st where st.id = p_appt.studio_id;
  select ss.notification_channels into v_channels from public.studio_settings ss where ss.studio_id = p_appt.studio_id;
  v_when := to_char(p_appt.start_at at time zone v_tz, 'DD.MM.YYYY, HH24:MI');
  v_title := case p_type
    when 'booking_created' then 'Новая запись'
    when 'booking_confirmed' then 'Запись подтверждена'
    when 'booking_cancelled' then 'Запись отменена'
    when 'booking_rescheduled' then 'Запись перенесена'
    when 'booking_reminder' then 'Напоминание о записи'
  end;
  v_payload := jsonb_build_object('start_at', p_appt.start_at, 'status', p_appt.status, 'staff_id', p_appt.staff_id,
                                  'service_id', p_appt.service_id, 'token', p_appt.manage_token);

  if p_type <> 'booking_reminder' then
    insert into public.notifications (studio_id, audience, type, appointment_id, title, body, payload)
    values (p_appt.studio_id, 'studio', p_type, p_appt.id, v_title, concat_ws(' · ', v_service, v_staff, v_when), v_payload)
    returning id into v_id;
    insert into public.notification_deliveries (notification_id, channel, status, attempts, sent_at)
    values (v_id, 'in_app', 'sent', 1, now());
  end if;

  select c.profile_id into v_profile from public.clients c where c.id = p_appt.client_id;
  if v_profile is not null then
    insert into public.notifications (studio_id, audience, recipient_profile_id, type, appointment_id, title, body, payload)
    values (p_appt.studio_id, 'client', v_profile, p_type, p_appt.id, v_title, concat_ws(' · ', v_service, v_staff, v_when), v_payload)
    returning id into v_id;
    insert into public.notification_deliveries (notification_id, channel, status, attempts, sent_at)
    values (v_id, 'in_app', 'sent', 1, now());
    -- Outbox rows for external channels; a worker (Edge Function) picks them up when a channel is enabled.
    insert into public.notification_deliveries (notification_id, channel, status)
    select v_id, ch, 'pending' from unnest(coalesce(v_channels, array[]::public.notification_channel[])) as ch
    where ch <> 'in_app';
  end if;
end $$;
revoke all on function public._enqueue_notification(public.appointments, public.notification_type) from public, anon, authenticated;

create or replace function public.tg_appointment_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_type public.notification_type;
begin
  if tg_op = 'INSERT' then
    v_type := 'booking_created';
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    v_type := 'booking_cancelled';
  elsif new.start_at <> old.start_at or new.staff_id <> old.staff_id then
    v_type := 'booking_rescheduled';
  elsif new.status = 'confirmed' and old.status = 'pending' then
    v_type := 'booking_confirmed';
  else
    return new;
  end if;
  perform public._enqueue_notification(new, v_type);
  return new;
end $$;

create trigger appointments_notify after insert or update of status, start_at, staff_id on public.appointments
  for each row execute function public.tg_appointment_notify();

-- Reminders for appointments in the next 24 hours. Schedule with pg_cron:
--   select cron.schedule('bookroom-reminders', '*/15 * * * *', $$select public.enqueue_appointment_reminders()$$);
create or replace function public.enqueue_appointment_reminders()
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  r public.appointments;
  v_count integer := 0;
begin
  for r in
    select * from public.appointments
    where status in ('pending', 'confirmed') and reminder_sent_at is null
      and start_at > now() and start_at <= now() + interval '24 hours'
    for update skip locked
  loop
    perform public._enqueue_notification(r, 'booking_reminder');
    update public.appointments set reminder_sent_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function public.enqueue_appointment_reminders() from public, anon, authenticated;

-- Admin helper: mark all studio notifications as read.
create or replace function public.mark_studio_notifications_read(p_studio_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.has_studio_role(p_studio_id) then raise exception 'FORBIDDEN'; end if;
  update public.notifications set read_at = now()
   where studio_id = p_studio_id and audience = 'studio' and read_at is null;
end $$;

revoke execute on function public.create_studio(text, text, text) from public, anon;
revoke execute on function public.claim_my_clients() from public, anon;
revoke execute on function public.mark_studio_notifications_read(uuid) from public, anon;
grant execute on function public.create_studio(text, text, text) to authenticated, service_role;
grant execute on function public.claim_my_clients() to authenticated, service_role;
grant execute on function public.mark_studio_notifications_read(uuid) to authenticated, service_role;
