-- =========================================================
-- 1. Tambahkan kolom email di profiles (untuk ditampilkan di
--    halaman Manajemen Pengguna). Aman dijalankan berkali-kali.
-- =========================================================
alter table profiles add column if not exists email text;

-- =========================================================
-- 2. Trigger: setiap kali ada user baru dibuat di Supabase Auth
--    (lewat Dashboard > Authentication > Add user), otomatis
--    buatkan baris di tabel profiles dengan role default
--    'staff_gudang' dan warehouse_id kosong (admin isi manual
--    nanti lewat halaman Manajemen Pengguna).
-- =========================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, nama, role)
  values (new.id, new.email, split_part(new.email, '@', 1), 'staff_gudang')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================
-- 3. Aktifkan Row Level Security di semua tabel
-- =========================================================
alter table categories enable row level security;
alter table posm_items enable row level security;
alter table warehouses enable row level security;
alter table stock enable row level security;
alter table stock_movements enable row level security;
alter table profiles enable row level security;

-- =========================================================
-- 4. Helper: cek apakah user yang sedang login adalah admin
-- =========================================================
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable set search_path = public;

create or replace function public.my_warehouse_id()
returns bigint as $$
  select warehouse_id from profiles where id = auth.uid();
$$ language sql security definer stable set search_path = public;

-- =========================================================
-- 5. Policies: categories & warehouses & posm_items
--    - Semua user login boleh BACA (perlu buat dropdown, dsb)
--    - Hanya admin boleh INSERT / UPDATE / DELETE
-- =========================================================
drop policy if exists "read categories" on categories;
create policy "read categories" on categories for select
  using (auth.role() = 'authenticated');

drop policy if exists "admin write categories" on categories;
create policy "admin write categories" on categories for all
  using (is_admin()) with check (is_admin());

drop policy if exists "read warehouses" on warehouses;
create policy "read warehouses" on warehouses for select
  using (auth.role() = 'authenticated');

drop policy if exists "admin write warehouses" on warehouses;
create policy "admin write warehouses" on warehouses for all
  using (is_admin()) with check (is_admin());

drop policy if exists "read posm_items" on posm_items;
create policy "read posm_items" on posm_items for select
  using (auth.role() = 'authenticated');

drop policy if exists "admin write posm_items" on posm_items;
create policy "admin write posm_items" on posm_items for all
  using (is_admin()) with check (is_admin());

-- =========================================================
-- 6. Policies: stock
--    - Admin: bebas akses semua baris
--    - Staff gudang: hanya baris dengan warehouse_id miliknya
-- =========================================================
drop policy if exists "select stock" on stock;
create policy "select stock" on stock for select
  using (is_admin() or warehouse_id = my_warehouse_id());

drop policy if exists "insert stock" on stock;
create policy "insert stock" on stock for insert
  with check (is_admin() or warehouse_id = my_warehouse_id());

drop policy if exists "update stock" on stock;
create policy "update stock" on stock for update
  using (is_admin() or warehouse_id = my_warehouse_id())
  with check (is_admin() or warehouse_id = my_warehouse_id());

drop policy if exists "delete stock" on stock;
create policy "delete stock" on stock for delete
  using (is_admin());

-- =========================================================
-- 7. Policies: stock_movements
--    - Admin: bebas akses semua baris (termasuk transfer lintas gudang)
--    - Staff gudang: hanya baris dengan warehouse_id miliknya
-- =========================================================
drop policy if exists "select stock_movements" on stock_movements;
create policy "select stock_movements" on stock_movements for select
  using (is_admin() or warehouse_id = my_warehouse_id());

drop policy if exists "insert stock_movements" on stock_movements;
create policy "insert stock_movements" on stock_movements for insert
  with check (is_admin() or warehouse_id = my_warehouse_id());

-- Staff gudang tidak boleh edit/hapus histori transaksi, hanya admin
drop policy if exists "admin update stock_movements" on stock_movements;
create policy "admin update stock_movements" on stock_movements for update
  using (is_admin()) with check (is_admin());

drop policy if exists "admin delete stock_movements" on stock_movements;
create policy "admin delete stock_movements" on stock_movements for delete
  using (is_admin());

-- =========================================================
-- 8. Policies: profiles
--    - Semua user boleh baca profile diri sendiri
--    - Admin boleh baca & edit semua profile
-- =========================================================
drop policy if exists "select own profile" on profiles;
create policy "select own profile" on profiles for select
  using (id = auth.uid() or is_admin());

drop policy if exists "admin update profiles" on profiles;
create policy "admin update profiles" on profiles for update
  using (is_admin()) with check (is_admin());
