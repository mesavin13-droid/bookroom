-- BOOKROOM: Storage buckets for studio assets, avatars and gallery.
-- Paths: studio-assets/<studio_id>/..., gallery/<studio_id>/..., avatars/<user_id>/...

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('studio-assets', 'studio-assets', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('gallery', 'gallery', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

create policy "bookroom public read"
  on storage.objects for select
  using (bucket_id in ('studio-assets', 'gallery', 'avatars'));

create policy "bookroom studio admins insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('studio-assets', 'gallery')
    and public.has_studio_role(public.try_uuid((storage.foldername(name))[1]))
  );
create policy "bookroom studio admins update"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('studio-assets', 'gallery')
    and public.has_studio_role(public.try_uuid((storage.foldername(name))[1]))
  );
create policy "bookroom studio admins delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('studio-assets', 'gallery')
    and public.has_studio_role(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "bookroom own avatar insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "bookroom own avatar update"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "bookroom own avatar delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
