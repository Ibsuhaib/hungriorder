-- hungriOrder — storage buckets and policies.
-- Buckets are public-read (menu photos / logos are public content).
-- Writes are restricted to the owning restaurant's admins: objects must live
-- under a top-level folder named after the admin's restaurant_id.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('menu-images', 'menu-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('restaurant-logos', 'restaurant-logos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Public read hungriorder images"
  on storage.objects for select
  using (bucket_id in ('menu-images', 'restaurant-logos'));

create policy "Admins upload to own restaurant folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('menu-images', 'restaurant-logos')
    and (storage.foldername(name))[1] = public.my_restaurant_id()::text
  );

create policy "Admins update own restaurant images"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('menu-images', 'restaurant-logos')
    and (storage.foldername(name))[1] = public.my_restaurant_id()::text
  );

create policy "Admins delete own restaurant images"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('menu-images', 'restaurant-logos')
    and (storage.foldername(name))[1] = public.my_restaurant_id()::text
  );
