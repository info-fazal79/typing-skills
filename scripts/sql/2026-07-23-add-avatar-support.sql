-- Profile photo support.
-- Run this once in the Supabase SQL editor for this project.

alter table users add column if not exists avatar_url text;

-- Public bucket for avatar images. Public read means anyone can view an
-- avatar via its URL (fine — they're not sensitive), while all writes go
-- through the server's service-role client (src/app/api/profile/avatar),
-- same trust model as every other table in this app.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
