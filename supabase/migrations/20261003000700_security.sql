-- BOOKROOM: security hardening (audit 2026-10-03).

-- ---------------------------------------------------------------------------
-- 1. CRITICAL: platform admin must come from a *verified* auth email.
--    profiles.email is user-editable, so granting by it allowed privilege
--    escalation (set your profile email to an admin address -> /platform).
-- ---------------------------------------------------------------------------
drop trigger if exists profiles_platform_admin on public.profiles;
drop function if exists public._grant_platform_admin_by_email();

create or replace function public._grant_platform_admin_verified()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is not null and new.email_confirmed_at is not null
     and exists (select 1 from public.platform_admin_emails e where e.email = lower(new.email))
     and exists (select 1 from public.profiles p where p.id = new.id) then
    insert into public.platform_admins (profile_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function public._grant_platform_admin_verified() from public, anon, authenticated;

-- Name sorts after on_auth_user_created, so the profile row already exists.
create trigger on_auth_user_platform_admin after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public._grant_platform_admin_verified();

-- Revoke grants that match the exploit signature: granted via a listed profile
-- email that is not the user's verified auth email.
delete from public.platform_admins pa
 using public.profiles p
 where p.id = pa.profile_id
   and exists (select 1 from public.platform_admin_emails e where e.email = lower(p.email))
   and not exists (
     select 1 from auth.users u join public.platform_admin_emails e on e.email = lower(u.email)
     where u.id = pa.profile_id and u.email_confirmed_at is not null
   );

-- ---------------------------------------------------------------------------
-- 2. Profiles: users may edit only harmless columns (not email, not Telegram id).
-- ---------------------------------------------------------------------------
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone, avatar_url, telegram_username, notify_email, notify_sms, notify_telegram)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Studios: only http(s) links can be stored (blocks javascript: URLs even
--    when the API is called directly, bypassing the app validation).
-- ---------------------------------------------------------------------------
alter table public.studios
  add constraint studios_website_http check (website is null or website ~* '^https?://[^\s]+$'),
  add constraint studios_logo_http check (logo_url is null or logo_url ~* '^https?://'),
  add constraint studios_cover_http check (cover_url is null or cover_url ~* '^https?://');
alter table public.staff add constraint staff_photo_http check (photo_url is null or photo_url ~* '^https?://');
alter table public.media add constraint media_url_http check (url ~* '^https?://');

-- Review photos: only files uploaded to our own gallery bucket.
alter table public.reviews
  add constraint reviews_photo_own_storage check (photo_url is null or photo_url ~ '^https?://[^/]+/storage/v1/object/public/gallery/');

-- ---------------------------------------------------------------------------
-- 4. Specialists (role staff) may only change the status of their own
--    appointments, not price, client, time or notes of the booking.
--    Applies to direct API writes only (current_user = authenticated);
--    trusted SECURITY DEFINER functions run as the owner role.
-- ---------------------------------------------------------------------------
create or replace function public._guard_staff_appointment_update()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user <> 'authenticated' or public.has_studio_role(old.studio_id) then
    return new;
  end if;
  if (new.studio_id, new.client_id, new.staff_id, new.service_id, new.start_at, new.end_at, new.price,
      new.source, new.manage_token, new.created_by, new.reminder_sent_at)
     is distinct from
     (old.studio_id, old.client_id, old.staff_id, old.service_id, old.start_at, old.end_at, old.price,
      old.source, old.manage_token, old.created_by, old.reminder_sent_at) then
    raise exception 'FORBIDDEN';
  end if;
  if new.status is distinct from old.status and new.status not in ('confirmed', 'completed', 'no_show') then
    raise exception 'FORBIDDEN';
  end if;
  return new;
end $$;
create trigger appointments_staff_guard before update on public.appointments
  for each row execute function public._guard_staff_appointment_update();

-- ---------------------------------------------------------------------------
-- 5. Anti-spam for online bookings (anyone can book without an account):
--    - max 3 upcoming active bookings per client in a studio;
--    - max 5 online bookings per client per hour;
--    - circuit breaker: max 30 online bookings per studio per 10 minutes.
-- ---------------------------------------------------------------------------
create or replace function public._limit_online_bookings()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.source <> 'online' then return new; end if;
  -- Only API traffic is limited; migrations, seeds and cron jobs have no JWT.
  if coalesce(current_setting('request.jwt.claims', true), '') = '' then return new; end if;
  if (select count(*) from public.appointments a
       where a.studio_id = new.studio_id and a.client_id = new.client_id
         and a.status in ('pending', 'confirmed') and a.end_at > now()) >= 3 then
    raise exception 'TOO_MANY_BOOKINGS';
  end if;
  if (select count(*) from public.appointments a
       where a.client_id = new.client_id and a.source = 'online' and a.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'RATE_LIMITED';
  end if;
  if (select count(*) from public.appointments a
       where a.studio_id = new.studio_id and a.source = 'online' and a.created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'RATE_LIMITED';
  end if;
  return new;
end $$;
revoke all on function public._limit_online_bookings() from public, anon, authenticated;
create trigger appointments_online_limits before insert on public.appointments
  for each row execute function public._limit_online_bookings();

-- ---------------------------------------------------------------------------
-- 6. Storage: public buckets serve files by URL without RLS; the blanket
--    SELECT policy only enabled *listing* every file (incl. unmoderated review
--    photos). Listing is now limited to the studio team and the avatar owner.
-- ---------------------------------------------------------------------------
drop policy if exists "bookroom public read" on storage.objects;
create policy "bookroom studio admins list"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('studio-assets', 'gallery')
    and public.has_studio_role(public.try_uuid((storage.foldername(name))[1]))
  );
create policy "bookroom own avatar list"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 7. Studio team: the last owner cannot be removed or demoted (no orphaned
--    studios, no lock-out), and memberships cannot be moved between studios.
-- ---------------------------------------------------------------------------
create or replace function public._guard_last_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.studio_id <> old.studio_id then raise exception 'FORBIDDEN'; end if;
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner')
     and not exists (select 1 from public.studio_members m
                      where m.studio_id = old.studio_id and m.role = 'owner' and m.profile_id <> old.profile_id)
     and exists (select 1 from public.studios s where s.id = old.studio_id) then
    raise exception 'LAST_OWNER';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function public._guard_last_owner() from public, anon, authenticated;
create trigger studio_members_last_owner before update or delete on public.studio_members
  for each row execute function public._guard_last_owner();

-- Trigger functions are never meant to be called through the API.
revoke all on function public._guard_studio_platform_fields() from public, anon, authenticated;
revoke all on function public._guard_staff_appointment_update() from public, anon;
