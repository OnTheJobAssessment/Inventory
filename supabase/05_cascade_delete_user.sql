-- Supaya kalau admin menghapus user (lewat Edge Function delete-user, yang
-- pakai Supabase Auth Admin API), baris terkait di tabel profiles otomatis
-- ikut terhapus juga (bukan jadi data nyangkut/orphan).
alter table profiles drop constraint if exists profiles_id_fkey;
alter table profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;
