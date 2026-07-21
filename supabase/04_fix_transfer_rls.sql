-- Perbaikan: staff gudang tujuan transfer perlu bisa melihat baris
-- stock_movements yang warehouse_tujuan_id-nya adalah gudang mereka
-- (sebelumnya cuma bisa lihat kalau warehouse_id = gudang mereka).
-- Ini penting supaya Kartu Stok & Riwayat Transaksi di gudang tujuan
-- ikut menampilkan transfer masuk.

drop policy if exists "select stock_movements" on stock_movements;
create policy "select stock_movements" on stock_movements for select
  using (
    is_admin()
    or warehouse_id = my_warehouse_id()
    or warehouse_tujuan_id = my_warehouse_id()
  );
