-- BOOKROOM: business verticals (beauty / auto), "from" prices, multi-day services,
-- vehicle details. Multi-day services occupy a resource (box / specialist) from the
-- start of its first working day to the end of its N-th working day; non-working
-- days in between are skipped (the car stays in the box).

create type public.studio_vertical as enum ('beauty', 'auto');

alter table public.studios add column vertical public.studio_vertical not null default 'beauty';

alter table public.services
  add column price_from boolean not null default false,
  add column duration_days smallint check (duration_days between 1 and 14);

alter table public.appointments
  add column vehicle_model text check (char_length(vehicle_model) <= 80),
  add column vehicle_plate text check (char_length(vehicle_plate) <= 20);

alter table public.clients
  add column vehicle_model text check (char_length(vehicle_model) <= 80),
  add column vehicle_plate text check (char_length(vehicle_plate) <= 20);

-- ---------------------------------------------------------------------------
-- Validates a resource window and returns the booking end.
-- ---------------------------------------------------------------------------
create or replace function public._booking_end(
  p_studio_id uuid, p_tz text, p_service public.services, p_staff_id uuid, p_start timestamptz
) returns timestamptz language plpgsql stable security definer set search_path = '' as $$
declare
  v_local timestamp := p_start at time zone p_tz;
  v_day date := (p_start at time zone p_tz)::date;
  v_sched public.staff_schedules;
  v_found integer := 0;
  v_end timestamp;
  v_i integer := 0;
begin
  if not exists (
    select 1 from public.staff s
    join public.staff_services ss on ss.staff_id = s.id and ss.service_id = p_service.id
    where s.id = p_staff_id and s.studio_id = p_studio_id and s.is_active and s.archived_at is null
  ) then
    raise exception 'STAFF_UNAVAILABLE';
  end if;

  if p_service.duration_days is null then
    perform public._assert_staff_window(p_studio_id, p_tz, p_service.id, p_service.duration_minutes, p_staff_id, p_start);
    return p_start + make_interval(mins => p_service.duration_minutes);
  end if;

  -- First day: must be a working day and start exactly at opening time.
  select * into v_sched from public.staff_schedules where staff_id = p_staff_id and weekday = extract(isodow from v_day)::int;
  if not found or not v_sched.is_working or v_local::time <> v_sched.start_time
     or exists (select 1 from public.days_off d where d.staff_id = p_staff_id and v_day between d.start_date and d.end_date) then
    raise exception 'SLOT_UNAVAILABLE';
  end if;

  while v_found < p_service.duration_days and v_i < 31 loop
    select * into v_sched from public.staff_schedules
      where staff_id = p_staff_id and weekday = extract(isodow from (v_day + v_i))::int;
    if found and v_sched.is_working and not exists (
      select 1 from public.days_off d where d.staff_id = p_staff_id and (v_day + v_i) between d.start_date and d.end_date
    ) then
      v_found := v_found + 1;
      v_end := (v_day + v_i) + v_sched.end_time;
    end if;
    v_i := v_i + 1;
  end loop;

  if v_found < p_service.duration_days then raise exception 'SLOT_UNAVAILABLE'; end if;
  return v_end at time zone p_tz;
end $$;
revoke all on function public._booking_end(uuid, text, public.services, uuid, timestamptz) from public, anon, authenticated;

-- Admin helper: compute the end of a booking (used by the admin panel).
create or replace function public.admin_booking_end(p_service_id uuid, p_staff_id uuid, p_start_at timestamptz)
returns timestamptz language plpgsql stable security definer set search_path = '' as $$
declare
  v_service public.services;
  v_tz text;
begin
  select * into v_service from public.services where id = p_service_id;
  if not found then raise exception 'SERVICE_NOT_FOUND'; end if;
  if not public.has_studio_role(v_service.studio_id) then raise exception 'FORBIDDEN'; end if;
  select timezone into v_tz from public.studios where id = v_service.studio_id;
  if v_service.duration_days is null then
    return p_start_at + make_interval(mins => v_service.duration_minutes);
  end if;
  return public._booking_end(v_service.studio_id, v_tz, v_service, p_staff_id, p_start_at);
end $$;
revoke execute on function public.admin_booking_end(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.admin_booking_end(uuid, uuid, timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Online booking v2 (vehicle details + multi-day)
-- ---------------------------------------------------------------------------
drop function if exists public.book_appointment(text, uuid, uuid, timestamptz, text, text, text, text);

create or replace function public.book_appointment(
  p_studio_slug text,
  p_service_id uuid,
  p_staff_id uuid,
  p_start_at timestamptz,
  p_name text,
  p_phone text,
  p_email text default null,
  p_notes text default null,
  p_vehicle_model text default null,
  p_vehicle_plate text default null
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_studio public.studios;
  v_settings public.studio_settings;
  v_service public.services;
  v_phone text := public.normalize_phone(p_phone);
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_name text := trim(coalesce(p_name, ''));
  v_model text := nullif(trim(coalesce(p_vehicle_model, '')), '');
  v_plate text := nullif(upper(trim(coalesce(p_vehicle_plate, ''))), '');
  v_uid uuid := auth.uid();
  v_client public.clients;
  v_appt public.appointments;
  v_candidate uuid;
  v_end timestamptz;
  v_auth_phone text;
  v_auth_email text;
  v_day_start timestamptz;
begin
  if v_phone is null then raise exception 'INVALID_PHONE'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then raise exception 'INVALID_NAME'; end if;
  if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'INVALID_EMAIL'; end if;
  if char_length(coalesce(p_notes, '')) > 500 then raise exception 'INVALID_NOTES'; end if;
  if char_length(coalesce(v_model, '')) > 80 or char_length(coalesce(v_plate, '')) > 20 then raise exception 'INVALID_VEHICLE'; end if;

  select * into v_studio from public.studios where slug = lower(p_studio_slug) and is_published;
  if not found then raise exception 'STUDIO_NOT_FOUND'; end if;
  if v_studio.vertical = 'auto' and v_model is null then raise exception 'VEHICLE_REQUIRED'; end if;
  select * into v_settings from public.studio_settings where studio_id = v_studio.id;

  select * into v_service from public.services
   where id = p_service_id and studio_id = v_studio.id and is_active and archived_at is null;
  if not found then raise exception 'SERVICE_NOT_FOUND'; end if;

  perform public._assert_booking_window(v_studio.timezone, v_settings, p_start_at);

  insert into public.clients (studio_id, name, phone, email, vehicle_model, vehicle_plate)
  values (v_studio.id, v_name, v_phone, v_email, v_model, v_plate)
  on conflict (studio_id, phone) do update
    set email = coalesce(public.clients.email, excluded.email),
        vehicle_model = coalesce(excluded.vehicle_model, public.clients.vehicle_model),
        vehicle_plate = coalesce(excluded.vehicle_plate, public.clients.vehicle_plate)
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
      v_end := public._booking_end(v_studio.id, v_studio.timezone, v_service, v_candidate, p_start_at);
      insert into public.appointments (
        studio_id, client_id, staff_id, service_id, start_at, end_at, price, status, source, notes, created_by,
        vehicle_model, vehicle_plate
      ) values (
        v_studio.id, v_client.id, v_candidate, v_service.id, p_start_at, v_end, v_service.price,
        case when v_settings.auto_confirm then 'confirmed'::public.appointment_status else 'pending'::public.appointment_status end,
        'online', nullif(trim(coalesce(p_notes, '')), ''), v_uid, v_model, v_plate
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

create or replace function public.reschedule_booking_by_token(p_token uuid, p_start_at timestamptz)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_appt public.appointments;
  v_settings public.studio_settings;
  v_studio public.studios;
  v_service public.services;
  v_end timestamptz;
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
  v_end := public._booking_end(v_studio.id, v_studio.timezone, v_service, v_appt.staff_id, p_start_at);

  begin
    update public.appointments
       set start_at = p_start_at,
           end_at = v_end,
           status = case when v_settings.auto_confirm then 'confirmed'::public.appointment_status else 'pending'::public.appointment_status end,
           reminder_sent_at = null
     where id = v_appt.id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN';
  end;
  return jsonb_build_object('id', v_appt.id, 'token', v_appt.manage_token);
end $$;

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
    'vehicle_model', a.vehicle_model,
    'vehicle_plate', a.vehicle_plate,
    'client_name', c.name,
    'client_phone', c.phone,
    'client_email', c.email,
    'has_account', c.profile_id is not null,
    'studio', jsonb_build_object('id', st.id, 'slug', st.slug, 'name', st.name, 'address', st.address, 'vertical', st.vertical,
      'phone', st.phone, 'timezone', st.timezone, 'currency', st.currency, 'latitude', st.latitude, 'longitude', st.longitude),
    'service', jsonb_build_object('id', sv.id, 'name', sv.name, 'duration_minutes', sv.duration_minutes,
      'duration_days', sv.duration_days, 'price_from', sv.price_from),
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
