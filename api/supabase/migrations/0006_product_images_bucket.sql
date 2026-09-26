-- Public Storage bucket for menu photos (see src/lib/storage.ts). The
-- admin page uploads here through api/ with the service_role key; nobody
-- uploads with the anon key, so no storage policies are needed. Public
-- read because menu photos are marketing material.
--
-- Run on BOTH databases (preview and production). Safe to re-run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  4194304, -- 4 MB, same cap as the upload route
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
