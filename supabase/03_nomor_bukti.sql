-- Tambah kolom nomor_bukti di stock_movements (untuk dicetak di Kartu Stok PDF)
-- Aman dijalankan berkali-kali.
alter table stock_movements add column if not exists nomor_bukti text;
