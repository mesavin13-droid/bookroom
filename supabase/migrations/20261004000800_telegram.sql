-- BOOKROOM: Telegram integration (login via bot, push dispatch, Mini App).
--
-- The schema already carries telegram_user_id on profiles/clients and the
-- 'telegram' value in notification_channel, plus the notification_deliveries
-- outbox. What was missing is the plumbing below.

-- ---------------------------------------------------------------------------
-- 1. Chat subscription.
--    A bot can only message a user who started it, so the chat id has to be
--    captured explicitly. Null telegram_chat_id = notifications not delivered.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists telegram_chat_id bigint;

create index if not exists profiles_telegram_chat_idx
  on public.profiles (telegram_chat_id)
  where telegram_chat_id is not null;

alter table public.studios
  add column if not exists owner_telegram_chat_id bigint;

alter table public.notification_deliveries
  add column if not exists claimed_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Claim the chat for the calling profile.
--    Called after the owner presses "Start" in the bot and comes back through
--    the Mini App, which passes the validated Telegram identity.
-- ---------------------------------------------------------------------------
create or replace function public.claim_telegram_chat(p_chat_id bigint, p_telegram_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_chat_id is null or p_telegram_id is null then raise exception 'INVALID_TELEGRAM_ID'; end if;

  -- The chat must belong to the same Telegram account as the profile we log in as.
  if not exists (select 1 from public.profiles p where p.telegram_user_id = p_telegram_id) then
    raise exception 'FORBIDDEN';
  end if;

  update public.profiles
     set telegram_chat_id = p_chat_id,
         notify_telegram = true
   where telegram_user_id = p_telegram_id;
end $$;
revoke all on function public.claim_telegram_chat(bigint, bigint) from public, anon;
grant execute on function public.claim_telegram_chat(bigint, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Claim a Telegram account during login.
--    Links the auth user to a Telegram identity, but only when that identity is
--    free. If it already belongs to a *different* profile we refuse, so nobody
--    can hijack an account by re-authenticating with a stranger's Telegram id
--    (profiles.email is user-editable and must never be trusted for identity).
-- ---------------------------------------------------------------------------
create or replace function public.claim_telegram_identity(
  p_profile_id uuid, p_telegram_id bigint, p_username text, p_name text, p_phone text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
begin
  if p_profile_id is null or p_telegram_id is null then raise exception 'INVALID_TELEGRAM_ID'; end if;

  select id into v_owner from public.profiles where telegram_user_id = p_telegram_id;
  if v_owner is not null and v_owner <> p_profile_id then raise exception 'TELEGRAM_IN_USE'; end if;

  update public.profiles
     set telegram_user_id  = p_telegram_id,
         telegram_username = nullif(p_username, ''),
         full_name         = coalesce(nullif(p_name, ''), full_name),
         phone             = coalesce(nullif(p_phone, ''), phone)
   where id = p_profile_id;
end $$;
revoke all on function public.claim_telegram_identity(uuid, bigint, text, text, text) from public, anon;
grant execute on function public.claim_telegram_identity(uuid, bigint, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Outbox drain for the Telegram channel.
--    Flips pending -> sending and only then returns rows, so two concurrent
--    drains can never deliver the same notification twice.
--    The dispatcher writes the final sent/failed state afterwards.
-- ---------------------------------------------------------------------------
create or replace function public.claim_pending_telegram(p_limit int default 50)
returns table (
  delivery_id uuid,
  chat_id bigint,
  title text,
  body text,
  studio_name text,
  studio_slug text,
  appointment_id uuid,
  manage_token uuid
) language plpgsql security definer set search_path = '' as $$
begin
  return query
  with picked as (
    select d.id, p.telegram_chat_id
      from public.notification_deliveries d
      join public.notifications n on n.id = d.notification_id
      left join public.profiles p on p.id = n.recipient_profile_id
     where d.channel = 'telegram'
       and d.status = 'pending'
       and n.audience = 'client'
       and p.telegram_chat_id is not null
       and p.notify_telegram
     order by d.created_at
     limit greatest(1, least(p_limit, 200))
     for update of d skip locked
  )
  update public.notification_deliveries d
     set status = 'sending', claimed_at = now()
    from picked, public.notifications n, public.profiles p, public.studios st
   where d.id = picked.id
     and n.id = d.notification_id
     and p.id = n.recipient_profile_id
     and st.id = n.studio_id
  returning d.id,
            picked.telegram_chat_id,
            n.title,
            n.body,
            st.name,
            st.slug,
            n.appointment_id,
            nullif(n.payload->>'token', '')::uuid;
end $$;
revoke all on function public.claim_pending_telegram(int) from public, anon, authenticated;
grant execute on function public.claim_pending_telegram(int) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Studio audience notifications (new booking, cancel, reschedule).
--    The studio owner may have no auth account at all - they can still receive
--    pushes straight in Telegram.
-- ---------------------------------------------------------------------------
create or replace function public.claim_pending_studio_telegram(p_limit int default 50)
returns table (
  delivery_id uuid,
  chat_id bigint,
  title text,
  body text,
  studio_name text,
  studio_slug text,
  appointment_id uuid,
  manage_token uuid
) language plpgsql security definer set search_path = '' as $$
begin
  return query
  with picked as (
    select d.id, s.owner_telegram_chat_id
      from public.notification_deliveries d
      join public.notifications n on n.id = d.notification_id
      join public.studios s on s.id = n.studio_id
     where d.channel = 'telegram'
       and d.status = 'pending'
       and n.audience = 'studio'
       and s.owner_telegram_chat_id is not null
     order by d.created_at
     limit greatest(1, least(p_limit, 200))
     for update of d skip locked
  )
  update public.notification_deliveries d
     set status = 'sending', claimed_at = now()
    from picked, public.notifications n, public.studios st
   where d.id = picked.id
     and n.id = d.notification_id
     and st.id = n.studio_id
  returning d.id,
            picked.owner_telegram_chat_id,
            n.title,
            n.body,
            st.name,
            st.slug,
            n.appointment_id,
            nullif(n.payload->>'token', '')::uuid;
end $$;
revoke all on function public.claim_pending_studio_telegram(int) from public, anon, authenticated;
grant execute on function public.claim_pending_studio_telegram(int) to service_role;

-- ---------------------------------------------------------------------------
-- 6. Record the outcome of a delivery attempt. Gives up after 5 tries.
-- ---------------------------------------------------------------------------
create or replace function public.finish_telegram_delivery(
  p_delivery_id uuid, p_ok boolean, p_error text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.notification_deliveries
     set status = case when p_ok then 'sent'::public.delivery_status
                       when attempts + 1 >= 5 then 'failed'::public.delivery_status
                       else 'pending'::public.delivery_status end,
         attempts = attempts + 1,
         last_error = left(coalesce(p_error, ''), 500),
         sent_at = case when p_ok then now() else sent_at end,
         claimed_at = null
   where id = p_delivery_id;
end $$;
revoke all on function public.finish_telegram_delivery(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.finish_telegram_delivery(uuid, boolean, text) to service_role;

-- ---------------------------------------------------------------------------
-- 7. The owner links the studio to their chat while signed in as a manager.
-- ---------------------------------------------------------------------------
create or replace function public.claim_studio_telegram(p_studio_id uuid, p_chat_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_studio_role(p_studio_id) then raise exception 'FORBIDDEN'; end if;
  if p_chat_id is null then raise exception 'INVALID_TELEGRAM_ID'; end if;
  update public.studios set owner_telegram_chat_id = p_chat_id where id = p_studio_id;
end $$;
revoke all on function public.claim_studio_telegram(uuid, bigint) from public, anon;
grant execute on function public.claim_studio_telegram(uuid, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Turn the telegram channel on as soon as the owner connects a chat,
--    so the trigger starts enqueuing deliveries instead of silently dropping them.
-- ---------------------------------------------------------------------------
create or replace function public.tg_sync_channel()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_telegram_chat_id is not null
     and (old.owner_telegram_chat_id is null or old.owner_telegram_chat_id <> new.owner_telegram_chat_id) then
    update public.studio_settings ss
       set notification_channels = (
             select coalesce(array_agg(distinct c), array[]::public.notification_channel[])
               from unnest(ss.notification_channels || array['telegram'::public.notification_channel]) as c
           )
     where ss.studio_id = new.id;
  end if;
  return new;
end $$;
revoke all on function public.tg_sync_channel() from public, anon, authenticated;
drop trigger if exists studios_tg_channel on public.studios;
create trigger studios_tg_channel after update of owner_telegram_chat_id on public.studios
  for each row execute function public.tg_sync_channel();

-- ---------------------------------------------------------------------------
-- 9. Anti-abuse: Telegram login must not become a bulk account factory.
-- ---------------------------------------------------------------------------
create or replace function public._limit_telegram_claims()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Only API traffic is limited; admin/console sessions carry no JWT claims.
  if coalesce(current_setting('request.jwt.claims', true), '') = '' then return new; end if;
  if (select count(*) from public.profiles p
        where p.telegram_user_id is not null
          and p.updated_at > now() - interval '10 minutes') >= 20 then
    raise exception 'RATE_LIMITED';
  end if;
  return new;
end $$;
revoke all on function public._limit_telegram_claims() from public, anon, authenticated;
drop trigger if exists profiles_telegram_limit on public.profiles;
create trigger profiles_telegram_limit before update of telegram_user_id on public.profiles
  for each row execute function public._limit_telegram_claims();

-- ---------------------------------------------------------------------------
-- 10. Safety-net scheduler.
--    Notifications are normally flushed right after a booking, but if the app
--    process died mid-request the outbox would keep 'pending' rows forever.
--    pg_cron calls the dispatcher over pg_net every 5 minutes.
--
--    The shared secret and the dispatcher URL live in Supabase Vault, never in
--    this repository:
--      select vault.create_secret('<secret>', 'bookroom_telegram_dispatch',
--                                'Shared secret for the Telegram dispatcher');
--      select vault.create_secret(
--               'https://<host>/api/internal/telegram/dispatch',
--               'bookroom_telegram_dispatch_url', 'Dispatcher endpoint');
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function public.bookroom_telegram_dispatch()
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_secret text;
  v_url text;
  v_id bigint;
begin
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'bookroom_telegram_dispatch';
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'bookroom_telegram_dispatch_url';

  -- Without both values the safety net stays idle; the post-booking flush in
  -- the app still delivers notifications.
  if v_secret is null or v_url is null then return null; end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object('content-type', 'application/json', 'x-telegram-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 50000
  ) into v_id;

  return v_id;
end $$;
revoke all on function public.bookroom_telegram_dispatch() from public, anon, authenticated;

-- Only schedule once; re-running the migration must not stack duplicates.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'bookroom-telegram-dispatch') then
    perform cron.schedule('bookroom-telegram-dispatch', '*/5 * * * *', 'select public.bookroom_telegram_dispatch()');
  end if;
end $$;