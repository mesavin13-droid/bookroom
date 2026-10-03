-- BOOKROOM: platform layer.
--   * Self-serve owners: create_studio v2 seeds a working studio (categories per
--     business type, first box/specialist, weekly schedule). New studios start as
--     drafts and go live when the owner publishes them.
--   * Platform admins (the product owner): see every studio, suspend / restore.
--     Access only through SECURITY DEFINER functions below; no table grants.

alter table public.studios
  add column suspended_at timestamptz,
  add column suspend_reason text check (char_length(suspend_reason) <= 300),
  add column created_by uuid references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Platform admins
-- ---------------------------------------------------------------------------
create table public.platform_admins (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
-- Emails that become platform admins automatically when they sign up.
create table public.platform_admin_emails (
  email text primary key check (email = lower(email))
);
create table public.platform_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  studio_id uuid references public.studios (id) on delete cascade,
  action text not null,
  reason text,
  created_at timestamptz not null default now()
);
create index platform_audit_studio_idx on public.platform_audit (studio_id, created_at desc);

alter table public.platform_admins enable row level security;
alter table public.platform_admin_emails enable row level security;
alter table public.platform_audit enable row level security;
revoke all on public.platform_admins, public.platform_admin_emails, public.platform_audit from anon, authenticated;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where profile_id = auth.uid())
$$;
revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated, service_role;

create or replace function public._assert_platform_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'FORBIDDEN'; end if;
end $$;
revoke all on function public._assert_platform_admin() from public, anon, authenticated;

create or replace function public._grant_platform_admin_by_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is not null and exists (select 1 from public.platform_admin_emails e where e.email = lower(new.email)) then
    insert into public.platform_admins (profile_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger profiles_platform_admin after insert or update of email on public.profiles
  for each row execute function public._grant_platform_admin_by_email();

-- Owners cannot touch suspension fields or re-publish a suspended studio.
create or replace function public._guard_studio_platform_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_platform_admin() then return new; end if;
  if new.suspended_at is distinct from old.suspended_at or new.suspend_reason is distinct from old.suspend_reason
     or new.created_by is distinct from old.created_by then
    raise exception 'FORBIDDEN';
  end if;
  if old.suspended_at is not null and new.is_published then
    raise exception 'STUDIO_SUSPENDED';
  end if;
  return new;
end $$;
create trigger studios_platform_guard before update on public.studios
  for each row execute function public._guard_studio_platform_fields();

-- ---------------------------------------------------------------------------
-- create_studio v2
-- ---------------------------------------------------------------------------
drop function if exists public.create_studio(text, text, text);

create or replace function public.create_studio(
  p_name text,
  p_slug text,
  p_timezone text default 'Europe/Moscow',
  p_vertical public.studio_vertical default 'beauty',
  p_kind text default null,
  p_city text default null,
  p_address text default null,
  p_phone text default null,
  p_owner_name text default null
) returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_staff uuid;
  v_auto boolean := p_vertical = 'auto';
  v_name text := nullif(trim(coalesce(p_owner_name, '')), '');
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'INVALID_TIMEZONE';
  end if;
  if lower(p_slug) in ('admin', 'platform', 'api', 'login', 'start', 'account', 'new', 'app', 'www') then
    raise exception 'SLUG_TAKEN';
  end if;
  if exists (select 1 from public.studios where slug = lower(p_slug)) then
    raise exception 'SLUG_TAKEN';
  end if;
  if (select count(*) from public.studio_members where profile_id = v_uid and role = 'owner') >= 10 then
    raise exception 'STUDIO_LIMIT';
  end if;

  insert into public.studios (name, slug, timezone, vertical, kind, city, address, phone, is_published, created_by)
  values (
    trim(p_name), lower(p_slug), p_timezone, p_vertical,
    nullif(trim(coalesce(p_kind, '')), ''), nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''), public.normalize_phone(p_phone),
    false, v_uid
  )
  returning id into v_id;

  insert into public.service_categories (studio_id, name, sort_order)
  select v_id, x.name, x.ord
  from unnest(
    case when v_auto
      then array['Мойка', 'Детейлинг', 'Защита кузова', 'Ремонт и ТО', 'Шиномонтаж', 'Другое']
      else array['Стрижка', 'Борода', 'Комплекс', 'Окрашивание', 'Уход', 'Другое']
    end
  ) with ordinality as x(name, ord);

  insert into public.staff (studio_id, name, position, sort_order)
  values (v_id, case when v_auto then 'Бокс 1' else coalesce(v_name, 'Мастер') end, case when v_auto then 'Бокс' else 'Мастер' end, 0)
  returning id into v_staff;

  insert into public.staff_schedules (studio_id, staff_id, weekday, is_working, start_time, end_time)
  select v_id, v_staff, d, d <= 6,
         case when v_auto then time '09:00' else time '10:00' end,
         case when v_auto then time '19:00' else time '20:00' end
  from generate_series(1, 7) as d;

  insert into public.studio_members (studio_id, profile_id, role, staff_id)
  values (v_id, v_uid, 'owner', case when v_auto then null else v_staff end);

  if v_name is not null then
    update public.profiles set full_name = v_name where id = v_uid and full_name is null;
  end if;
  return v_id;
end $$;
revoke execute on function public.create_studio(text, text, text, public.studio_vertical, text, text, text, text, text) from public, anon;
grant execute on function public.create_studio(text, text, text, public.studio_vertical, text, text, text, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Platform read models
-- ---------------------------------------------------------------------------
create or replace function public.platform_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  perform public._assert_platform_admin();
  select jsonb_build_object(
    'studios_total', (select count(*) from public.studios),
    'studios_live', (select count(*) from public.studios where is_published and suspended_at is null),
    'studios_draft', (select count(*) from public.studios where not is_published and suspended_at is null),
    'studios_suspended', (select count(*) from public.studios where suspended_at is not null),
    'studios_new_7d', (select count(*) from public.studios where created_at > now() - interval '7 days'),
    'owners_total', (select count(distinct profile_id) from public.studio_members where role = 'owner'),
    'clients_total', (select count(*) from public.clients),
    'appointments_30d', (select count(*) from public.appointments where created_at > now() - interval '30 days'),
    'appointments_upcoming', (select count(*) from public.appointments where start_at > now() and status in ('pending', 'confirmed')),
    'revenue_30d', (select coalesce(sum(price), 0) from public.appointments where status = 'completed' and start_at > now() - interval '30 days'),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'bookings', b, 'studios', s) order by d), '[]'::jsonb)
      from (
        select d,
               (select count(*) from public.appointments a where a.created_at >= d and a.created_at < d + interval '1 day') as b,
               (select count(*) from public.studios st where st.created_at >= d and st.created_at < d + interval '1 day') as s
        from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') as d
      ) x
    )
  ) into v;
  return v;
end $$;

create or replace function public.platform_studios(
  p_q text default null, p_status text default 'all', p_limit integer default 30, p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_q text := nullif(trim(coalesce(p_q, '')), '');
  v jsonb;
begin
  perform public._assert_platform_admin();
  with base as (
    select s.*,
           o.full_name as owner_name, o.email as owner_email, o.phone as owner_phone
    from public.studios s
    left join lateral (
      select p.full_name, p.email, p.phone
      from public.studio_members m join public.profiles p on p.id = m.profile_id
      where m.studio_id = s.id and m.role = 'owner'
      order by m.created_at limit 1
    ) o on true
    where (v_q is null
           or s.name ilike '%' || v_q || '%' or s.slug ilike '%' || v_q || '%' or s.city ilike '%' || v_q || '%'
           or o.email ilike '%' || v_q || '%' or o.phone ilike '%' || v_q || '%')
      and case p_status
            when 'live' then s.is_published and s.suspended_at is null
            when 'draft' then not s.is_published and s.suspended_at is null
            when 'suspended' then s.suspended_at is not null
            else true end
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'items', coalesce((
      select jsonb_agg(row_to_json(r)::jsonb order by r.created_at desc)
      from (
        select b.id, b.slug, b.name, b.vertical, b.kind, b.city, b.logo_url, b.is_published, b.suspended_at, b.created_at,
               b.owner_name, b.owner_email, b.owner_phone,
               (select count(*) from public.services sv where sv.studio_id = b.id and sv.archived_at is null) as services,
               (select count(*) from public.appointments a where a.studio_id = b.id and a.created_at > now() - interval '30 days') as bookings_30d,
               (select max(a.created_at) from public.appointments a where a.studio_id = b.id) as last_booking_at
        from base b
        order by b.created_at desc
        limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
      ) r
    ), '[]'::jsonb)
  ) into v;
  return v;
end $$;

create or replace function public.platform_studio(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  perform public._assert_platform_admin();
  select jsonb_build_object(
    'studio', to_jsonb(s),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('role', m.role, 'name', p.full_name, 'email', p.email, 'phone', p.phone, 'since', m.created_at) order by m.created_at)
      from public.studio_members m join public.profiles p on p.id = m.profile_id where m.studio_id = s.id
    ), '[]'::jsonb),
    'counts', jsonb_build_object(
      'services', (select count(*) from public.services x where x.studio_id = s.id and x.archived_at is null),
      'staff', (select count(*) from public.staff x where x.studio_id = s.id and x.archived_at is null),
      'clients', (select count(*) from public.clients x where x.studio_id = s.id),
      'appointments', (select count(*) from public.appointments x where x.studio_id = s.id),
      'appointments_30d', (select count(*) from public.appointments x where x.studio_id = s.id and x.created_at > now() - interval '30 days'),
      'revenue_30d', (select coalesce(sum(x.price), 0) from public.appointments x where x.studio_id = s.id and x.status = 'completed' and x.start_at > now() - interval '30 days'),
      'reviews', (select count(*) from public.reviews x where x.studio_id = s.id),
      'photos', (select count(*) from public.media x where x.studio_id = s.id)
    ),
    'recent', coalesce((
      select jsonb_agg(r order by r.start_at desc) from (
        select a.id, a.start_at, a.status, a.price, sv.name as service
        from public.appointments a left join public.services sv on sv.id = a.service_id
        where a.studio_id = s.id order by a.start_at desc limit 10
      ) r
    ), '[]'::jsonb),
    'audit', coalesce((
      select jsonb_agg(jsonb_build_object('action', l.action, 'reason', l.reason, 'at', l.created_at, 'actor', p.full_name, 'actor_email', p.email) order by l.created_at desc)
      from public.platform_audit l left join public.profiles p on p.id = l.actor_id where l.studio_id = s.id
    ), '[]'::jsonb)
  ) into v
  from public.studios s where s.id = p_id;
  if v is null then raise exception 'NOT_FOUND'; end if;
  return v;
end $$;

create or replace function public.platform_set_studio_status(p_id uuid, p_action text, p_reason text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare v_reason text := left(nullif(trim(coalesce(p_reason, '')), ''), 300);
begin
  perform public._assert_platform_admin();
  if not exists (select 1 from public.studios where id = p_id) then raise exception 'NOT_FOUND'; end if;
  if p_action = 'suspend' then
    if v_reason is null then raise exception 'REASON_REQUIRED'; end if;
    update public.studios set suspended_at = now(), suspend_reason = v_reason, is_published = false where id = p_id;
  elsif p_action = 'restore' then
    update public.studios set suspended_at = null, suspend_reason = null, is_published = true where id = p_id;
  elsif p_action = 'unpublish' then
    update public.studios set is_published = false where id = p_id;
  else
    raise exception 'INVALID_ACTION';
  end if;
  insert into public.platform_audit (actor_id, studio_id, action, reason) values (auth.uid(), p_id, p_action, v_reason);
end $$;

revoke execute on function public.platform_overview() from public, anon;
revoke execute on function public.platform_studios(text, text, integer, integer) from public, anon;
revoke execute on function public.platform_studio(uuid) from public, anon;
revoke execute on function public.platform_set_studio_status(uuid, text, text) from public, anon;
grant execute on function public.platform_overview() to authenticated;
grant execute on function public.platform_studios(text, text, integer, integer) to authenticated;
grant execute on function public.platform_studio(uuid) to authenticated;
grant execute on function public.platform_set_studio_status(uuid, text, text) to authenticated;
