-- BOOKROOM: Row Level Security.
-- Roles: anon (public visitors), authenticated clients, studio staff, admins, owners.
-- Nothing is fully public: public reads are limited to published studio catalogs.

alter table public.profiles enable row level security;
alter table public.studios enable row level security;
alter table public.studio_settings enable row level security;
alter table public.studio_members enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.staff enable row level security;
alter table public.staff_services enable row level security;
alter table public.staff_schedules enable row level security;
alter table public.schedule_breaks enable row level security;
alter table public.days_off enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.media enable row level security;

-- profiles ------------------------------------------------------------------
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- studios -------------------------------------------------------------------
create policy studios_select on public.studios for select
  using (is_published or public.is_studio_member(id));
create policy studios_update on public.studios for update to authenticated
  using (public.has_studio_role(id)) with check (public.has_studio_role(id));
create policy studios_delete on public.studios for delete to authenticated
  using (public.has_studio_role(id, array['owner']::public.studio_role[]));

-- studio_settings -----------------------------------------------------------
create policy settings_select on public.studio_settings for select
  using (public.studio_is_public(studio_id) or public.is_studio_member(studio_id));
create policy settings_update on public.studio_settings for update to authenticated
  using (public.has_studio_role(studio_id)) with check (public.has_studio_role(studio_id));

-- studio_members ------------------------------------------------------------
create policy members_select on public.studio_members for select to authenticated
  using (profile_id = auth.uid() or public.has_studio_role(studio_id));
create policy members_write on public.studio_members for all to authenticated
  using (public.has_studio_role(studio_id, array['owner']::public.studio_role[]))
  with check (public.has_studio_role(studio_id, array['owner']::public.studio_role[]));

-- catalog: categories, services, staff, links, schedules, media ------------
create policy categories_select on public.service_categories for select
  using (public.studio_is_public(studio_id) or public.is_studio_member(studio_id));
create policy categories_write on public.service_categories for all to authenticated
  using (public.has_studio_role(studio_id)) with check (public.has_studio_role(studio_id));

create policy services_select on public.services for select
  using ((is_active and archived_at is null and public.studio_is_public(studio_id)) or public.is_studio_member(studio_id));
create policy services_write on public.services for all to authenticated
  using (public.has_studio_role(studio_id)) with check (public.has_studio_role(studio_id));

create policy staff_select on public.staff for select
  using ((is_active and archived_at is null and public.studio_is_public(studio_id)) or public.is_studio_member(studio_id));
create policy staff_write on public.staff for all to authenticated
  using (public.has_studio_role(studio_id)) with check (public.has_studio_role(studio_id));

create policy staff_services_select on public.staff_services for select
  using (public.studio_is_public(studio_id) or public.is_studio_member(studio_id));
create policy staff_services_write on public.staff_services for all to authenticated
  using (public.has_studio_role(studio_id)) with check (public.has_studio_role(studio_id));

-- Working hours are public information (needed to show availability).
create policy schedules_select on public.staff_schedules for select
  using (public.studio_is_public(studio_id) or public.is_studio_member(studio_id));
create policy schedules_write on public.staff_schedules for all to authenticated
  using (public.has_studio_role(studio_id)) with check (public.has_studio_role(studio_id));

create policy breaks_select on public.schedule_breaks for select
  using (public.studio_is_public(studio_id) or public.is_studio_member(studio_id));
create policy breaks_write on public.schedule_breaks for all to authenticated
  using (public.has_studio_role(studio_id)) with check (public.has_studio_role(studio_id));

-- Days off / vacations are private (reasons). Public availability uses get_availability_data().
create policy days_off_select on public.days_off for select to authenticated
  using (public.has_studio_role(studio_id) or staff_id = public.my_staff_id(studio_id));
create policy days_off_write on public.days_off for all to authenticated
  using (public.has_studio_role(studio_id)) with check (public.has_studio_role(studio_id));

create policy media_select on public.media for select
  using (public.studio_is_public(studio_id) or public.is_studio_member(studio_id));
create policy media_write on public.media for all to authenticated
  using (public.has_studio_role(studio_id)) with check (public.has_studio_role(studio_id));

-- clients -------------------------------------------------------------------
create policy clients_select on public.clients for select to authenticated
  using (
    public.has_studio_role(studio_id)
    or profile_id = auth.uid()
    or public.staff_serves_client(id)
  );
create policy clients_write on public.clients for all to authenticated
  using (public.has_studio_role(studio_id)) with check (public.has_studio_role(studio_id));

-- appointments --------------------------------------------------------------
create policy appointments_select on public.appointments for select to authenticated
  using (
    public.has_studio_role(studio_id)
    or staff_id = public.my_staff_id(studio_id)
    or public.is_my_client(client_id)
  );
create policy appointments_insert on public.appointments for insert to authenticated
  with check (public.has_studio_role(studio_id));
create policy appointments_update_admin on public.appointments for update to authenticated
  using (public.has_studio_role(studio_id)) with check (public.has_studio_role(studio_id));
-- A specialist may update only their own appointments (e.g. mark completed / no-show).
create policy appointments_update_staff on public.appointments for update to authenticated
  using (staff_id = public.my_staff_id(studio_id))
  with check (staff_id = public.my_staff_id(studio_id));
create policy appointments_delete on public.appointments for delete to authenticated
  using (public.has_studio_role(studio_id, array['owner']::public.studio_role[]));

-- reviews -------------------------------------------------------------------
create policy reviews_select on public.reviews for select
  using (
    (status = 'published' and public.studio_is_public(studio_id))
    or public.has_studio_role(studio_id)
    or (client_id is not null and public.is_my_client(client_id))
  );
create policy reviews_update on public.reviews for update to authenticated
  using (public.has_studio_role(studio_id)) with check (public.has_studio_role(studio_id));
create policy reviews_delete on public.reviews for delete to authenticated
  using (public.has_studio_role(studio_id));

-- notifications -------------------------------------------------------------
create policy notifications_select on public.notifications for select to authenticated
  using (
    recipient_profile_id = auth.uid()
    or (audience = 'studio' and public.has_studio_role(studio_id))
  );
create policy notifications_update on public.notifications for update to authenticated
  using (recipient_profile_id = auth.uid() or (audience = 'studio' and public.has_studio_role(studio_id)))
  with check (recipient_profile_id = auth.uid() or (audience = 'studio' and public.has_studio_role(studio_id)));

create policy deliveries_select on public.notification_deliveries for select to authenticated
  using (exists (
    select 1 from public.notifications n
    where n.id = notification_id and n.audience = 'studio' and public.has_studio_role(n.studio_id)
  ));

-- Column-level hardening: clients cannot change who a notification belongs to.
revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Anonymous visitors never write directly; all guest writes go through RPCs.
revoke insert, update, delete on all tables in schema public from anon;
