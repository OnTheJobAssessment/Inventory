-- Referensi: skema ini yang sudah dijalankan di Supabase SQL Editor.
-- Disimpan di sini supaya ada dokumentasinya di repo.

create table categories (
  id bigint generated always as identity primary key,
  nama text not null
);

create table posm_items (
  id bigint generated always as identity primary key,
  kode_posm text unique not null,
  nama text not null,
  kategori_id bigint references categories(id),
  satuan text not null,
  stok_minimum int default 0,
  created_at timestamptz default now()
);

create table warehouses (
  id bigint generated always as identity primary key,
  nama_gudang text not null,
  alamat text
);

create table stock (
  id bigint generated always as identity primary key,
  posm_item_id bigint references posm_items(id),
  warehouse_id bigint references warehouses(id),
  jumlah int default 0,
  unique(posm_item_id, warehouse_id)
);

create table stock_movements (
  id bigint generated always as identity primary key,
  posm_item_id bigint references posm_items(id),
  warehouse_id bigint references warehouses(id),
  tipe text not null,
  jumlah int not null,
  warehouse_tujuan_id bigint references warehouses(id),
  keterangan text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table profiles (
  id uuid references auth.users(id) primary key,
  nama text,
  role text not null default 'staff_gudang',
  warehouse_id bigint references warehouses(id)
);
