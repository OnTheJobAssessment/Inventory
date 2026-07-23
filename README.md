# POSM Inventory — Tutorial Lengkap

Aplikasi web manajemen stok POSM (Point of Sale Materials) multi-gudang.
Stack: **React (Vite) + Supabase + Vercel + GitHub**.

Role: `admin` (akses semua gudang, kelola master data & user), `staff_gudang`
(hanya akses gudang miliknya sendiri), dan `frontliner` (hanya bisa scan
barcode untuk mengurangi stok).

---

## 🆕 Update Terbaru — Apa yang Berubah

Kalau kamu **sudah pernah deploy** versi sebelumnya, ini daftar hal yang
perlu dilakukan ulang (langkah lengkapnya ada di masing-masing bagian di
bawah — bagian ini cuma ringkasan/checklist):

1. **Jalankan 3 file SQL baru** di Supabase SQL Editor (urutannya penting):
   `supabase/03_nomor_bukti.sql`, `supabase/04_fix_transfer_rls.sql` →
   lihat [Bagian 2](#2-persiapan-supabase)
2. **Deploy Edge Function `create-user`** supaya admin bisa tambah user
   langsung dari web (tanpa buka Supabase Dashboard) →
   lihat [Bagian 3](#3-deploy-edge-function-create-user)
3. **Tarik kode terbaru & install ulang dependency** (`npm install`) — ada
   library baru: `jspdf`, `jsbarcode`, `html5-qrcode`, `qrcode`
4. **Push & redeploy ke Vercel** seperti biasa (`git push`)
5. **Cetak ulang label barcode** yang lama lewat menu Cetak Barcode — label
   versi sebelumnya (cuma CODE128) tetap bisa discan tapi kurang andal lewat
   kamera HP; versi baru menambahkan QR code yang jauh lebih mudah dibaca

Fitur-fitur baru yang ditambahkan:

| Fitur | Halaman | Keterangan |
|---|---|---|
| Konfirmasi sebelum logout | Semua (tombol "Keluar" di sidebar) | Muncul dialog konfirmasi, tidak langsung logout |
| Auto-logout setelah idle | Seluruh aplikasi | Otomatis logout kalau tidak ada aktivitas 30 menit |
| Cetak Kartu Stok (PDF) | Stok Gudang | Tombol "Cetak Kartu Stok" per item, formatnya mengikuti kartu stok fisik (TGL/NOMOR BUKTI/DARI-KEPADA/MUTASI/SALDO) |
| Nomor Bukti di transaksi | Input Mutasi, Transfer | Field baru untuk nomor surat jalan/bukti serah terima |
| Tambah user dari web | Manajemen Pengguna | Admin bisa buat akun baru tanpa ke Supabase Dashboard |
| Role baru: Frontliner | Manajemen Pengguna | Role khusus yang cuma bisa akses halaman Scan |
| Cetak Barcode | Cetak Barcode (menu baru, admin) | Generate label berisi QR code (utama) + barcode CODE128 (cadangan) per item POSM |
| 🆕 Cetak jadi PDF, bukan print browser | Cetak Barcode | Tombol cetak diganti jadi "Download PDF" — hasil satu file PDF, layout tetap 2 kolom per halaman A4, satu kotak per item |
| Scan Stok Keluar | Scan Stok Keluar (menu baru) | Scan barcode pakai kamera HP → langsung kurangi stok |
| 🆕 Input Manual Stok Keluar | Scan Stok Keluar | Alternatif kalau scan tidak memungkinkan — pilih item dari daftar, tidak perlu kamera |
| 🆕 Scan pakai QR code | Scan Stok Keluar, Cetak Barcode | Format utama diganti dari barcode 1D ke QR code — jauh lebih andal dibaca kamera HP dibanding barcode garis-garis |
| 🆕 Download Kartu Stok dari Scan | Scan Stok Keluar | Setelah scan/pilih item, ada tombol untuk langsung download Kartu Stok PDF-nya — bisa dipakai frontliner juga |
| Perbaikan kamera scan di HP | Scan Stok Keluar | Perbaikan bug render + fallback otomatis kalau kamera belakang tidak terdeteksi |
| Tampilan responsif | Seluruh aplikasi | Sidebar jadi menu hamburger di HP/tablet, tabel bisa discroll |

---

## Daftar Isi

1. [Struktur Project](#1-struktur-project)
2. [Persiapan Supabase](#2-persiapan-supabase)
3. [Deploy Edge Function create-user](#3-deploy-edge-function-create-user)
4. [Membuat User Admin Pertama](#4-membuat-user-admin-pertama)
5. [Setup Project di Komputer Lokal](#5-setup-project-di-komputer-lokal)
6. [Menjalankan di Local](#6-menjalankan-di-local)
7. [Push Kode ke GitHub](#7-push-kode-ke-github)
8. [Deploy ke Vercel](#8-deploy-ke-vercel)
9. [Cara Pakai Aplikasi](#9-cara-pakai-aplikasi)
10. [Menambah User Baru](#10-menambah-user-baru)
11. [Cetak & Scan Barcode](#11-cetak--scan-barcode)
12. [Cetak Kartu Stok (PDF)](#12-cetak-kartu-stok-pdf)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Struktur Project

```
posm-inventory/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env.example              ← contoh env var, salin jadi .env
├── .gitignore
├── supabase/
│   ├── 01_schema.sql          ← skema tabel (referensi, sudah kamu jalankan)
│   ├── 02_auth_and_rls.sql    ← WAJIB: trigger user baru + RLS policy
│   ├── 03_nomor_bukti.sql     ← 🆕 WAJIB: kolom nomor bukti transaksi
│   ├── 04_fix_transfer_rls.sql← 🆕 WAJIB: transfer masuk kebaca gudang tujuan
│   └── functions/
│       └── create-user/
│           └── index.ts       ← 🆕 Edge Function: tambah user dari web
└── src/
    ├── main.jsx               ← entry point React
    ├── App.jsx                 ← routing semua halaman
    ├── index.css                ← styling global (Tailwind) + CSS print
    ├── lib/
    │   ├── supabaseClient.js       ← koneksi ke Supabase
    │   └── kartuStok.js             ← 🆕 generator PDF Kartu Stok
    ├── context/
    │   └── AuthContext.jsx         ← state login, role user, 🆕 auto-logout idle
    ├── components/
    │   ├── ProtectedRoute.jsx      ← proteksi halaman butuh login/admin
    │   ├── ConfirmDialog.jsx        ← 🆕 dialog konfirmasi (dipakai saat logout)
    │   └── Layout.jsx               ← sidebar navigasi, 🆕 responsif + role-aware
    └── pages/
        ├── Login.jsx
        ├── Dashboard.jsx
        ├── Stock.jsx                ← lihat stok per gudang, 🆕 cetak Kartu Stok
        ├── StockMovement.jsx        ← input stok masuk/keluar/adjustment
        ├── Transfer.jsx             ← transfer antar gudang (admin)
        ├── History.jsx              ← riwayat transaksi
        ├── MasterPosm.jsx           ← CRUD item POSM & kategori (admin)
        ├── MasterGudang.jsx         ← CRUD gudang (admin)
        ├── UserManagement.jsx       ← atur user, 🆕 form tambah user langsung
        ├── BarcodePrint.jsx         ← 🆕 cetak label barcode (admin)
        └── ScanKeluar.jsx           ← 🆕 scan barcode untuk kurangi stok
```

---

## 2. Persiapan Supabase

Kamu sudah menjalankan skema dasar (`categories`, `posm_items`, `warehouses`,
`stock`, `stock_movements`, `profiles`). Sekarang jalankan **tiga file SQL**
di **SQL Editor** Supabase, **satu per satu, sesuai urutan nomornya**:

1. Buka project Supabase kamu → menu **SQL Editor** → **New query**
2. Copy-paste isi `supabase/02_auth_and_rls.sql` → klik **Run**
3. New query lagi → copy-paste isi `supabase/03_nomor_bukti.sql` → **Run**
4. New query lagi → copy-paste isi `supabase/04_fix_transfer_rls.sql` → **Run**

Kalau kamu instalasi baru (belum pernah jalankan `02_auth_and_rls.sql` sama
sekali), cukup jalankan ketiganya berurutan dari nomor 02 — tidak perlu
langkah tambahan lain.

Ringkasan isi masing-masing file:

| File | Fungsi |
|---|---|
| `02_auth_and_rls.sql` | Kolom `email` di `profiles`, trigger otomatis bikin profile saat user baru dibuat, dan Row Level Security dasar (staff hanya akses gudangnya) |
| `03_nomor_bukti.sql` | Tambah kolom `nomor_bukti` di `stock_movements` — dipakai di form Input Mutasi/Transfer dan tercetak di Kartu Stok |
| `04_fix_transfer_rls.sql` | Perbaikan RLS supaya gudang **tujuan** transfer juga bisa lihat transaksi transfer masuk (sebelumnya cuma gudang asal yang bisa lihat) |

> ⚠️ Tanpa `02_auth_and_rls.sql`, tabel-tabel kamu **tidak punya proteksi
> akses sama sekali**. Ini wajib, jangan dilewati.

### Ambil kredensial Supabase

Di dashboard Supabase → **Project Settings → API**, catat:

- **Project URL** → contoh: `https://xxxxxxxxxxxx.supabase.co`
- **anon public key** → key panjang di bagian "Project API keys"

Jangan pernah pakai `service_role key` di frontend — key itu dipakai khusus
di Edge Function (lihat Bagian 3), bukan di kode React.

---

## 3. Deploy Edge Function create-user

Fitur "Tambah User" di halaman Manajemen Pengguna butuh **Edge Function** —
kode kecil yang jalan di server Supabase (bukan di browser), supaya
`service_role key` yang dibutuhkan untuk membuat akun tidak pernah terekspos
ke publik.

**Prasyarat:** install Supabase CLI kalau belum ada:

```bash
npm install -g supabase
```

**Langkah deploy:**

1. Login ke Supabase CLI:

   ```bash
   supabase login
   ```

2. Dari folder project (`posm-inventory`), hubungkan ke project Supabase kamu
   (Project Ref bisa dilihat di Project Settings → General → Reference ID):

   ```bash
   supabase link --project-ref xxxxxxxxxxxx
   ```

3. Deploy function-nya:

   ```bash
   supabase functions deploy create-user
   ```

Supabase otomatis menyediakan `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan
`SUPABASE_SERVICE_ROLE_KEY` sebagai environment variable di dalam Edge
Function — **tidak perlu di-set manual**.

**Verifikasi berhasil:** buka **Edge Functions** di dashboard Supabase,
pastikan `create-user` muncul dengan status aktif. Kalau nanti tombol
"Tambah User" di web gagal, cek log-nya di sini juga (tab **Logs**).

> 💡 Kalau kamu belum familiar dengan terminal/CLI dan ingin skip fitur ini
> dulu, tidak masalah — semua fitur lain tetap jalan normal, kamu tinggal
> lanjut pakai cara lama (buat user lewat Supabase Dashboard, lalu atur role
> lewat halaman Manajemen Pengguna seperti biasa).

---

## 4. Membuat User Admin Pertama

User pertama tetap harus dibuat manual lewat Supabase Dashboard (karena
Edge Function `create-user` butuh admin yang sudah ada untuk memanggilnya):

1. Buka **Authentication → Users** di dashboard Supabase
2. Klik **Add user** → **Create new user**
3. Isi email & password, centang **Auto confirm user** supaya bisa langsung
   login
4. Klik **Create user**

Setelah dibuat, trigger otomatis akan membuat baris di tabel `profiles`.
Sekarang jadikan user ini **admin**:

1. Buka **Table Editor → profiles**
2. Cari baris dengan email yang baru dibuat
3. Ubah kolom `role` dari `staff_gudang` menjadi `admin`
4. Simpan

Setelah ini, **semua user berikutnya** bisa dibuat langsung dari halaman
Manajemen Pengguna di web (lihat Bagian 10) — tidak perlu buka Supabase
Dashboard lagi.

---

## 5. Setup Project di Komputer Lokal

**Prasyarat**: Node.js sudah terpasang (cek dengan `node -v`, minimal versi 18).

1. Extract/simpan folder `posm-inventory` ini di komputer kamu
2. Buka folder ini di VS Code, lalu buka Terminal (`Terminal → New Terminal`)
3. Install dependencies:

   ```bash
   npm install
   ```

4. Salin file env var:

   ```bash
   cp .env.example .env
   ```

5. Buka file `.env`, isi dengan kredensial Supabase dari Bagian 2:

   ```
   VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=isi-dengan-anon-key-kamu
   ```

---

## 6. Menjalankan di Local

```bash
npm run dev
```

Buka browser ke `http://localhost:5173`. Login dengan akun admin yang sudah
dibuat di Bagian 4.

Coba alur dasar:
1. Login sebagai admin
2. Buka **Master Gudang** → tambah minimal 2 gudang
3. Buka **Master POSM** → tambah kategori, lalu tambah 1-2 item POSM
4. Buka **Input Mutasi** → catat stok masuk untuk item tadi di salah satu gudang
5. Buka **Stok Gudang** → pastikan angkanya muncul benar, coba tombol **Cetak Kartu Stok**
6. Buka **Transfer Antar Gudang** → coba pindahkan sebagian stok ke gudang lain
7. Buka **Cetak Barcode** → cetak label untuk 1 item, lalu buka **Scan Stok Keluar** dan coba scan (butuh HTTPS atau localhost supaya kamera diizinkan browser)

Kalau semua langkah di atas jalan lancar, aplikasi siap di-deploy.

---

## 7. Push Kode ke GitHub

1. Buat repository baru di GitHub (jangan centang "Add README", karena
   sudah ada di project ini)
2. Di terminal, dari folder project:

   ```bash
   git init
   git add .
   git commit -m "Initial commit - POSM inventory app"
   git branch -M main
   git remote add origin https://github.com/USERNAME/NAMA-REPO.git
   git push -u origin main
   ```

   Ganti `USERNAME/NAMA-REPO` dengan repo GitHub kamu.

   Kalau ini update dari project yang sudah ada, cukup:

   ```bash
   git add .
   git commit -m "Tambah fitur: barcode, scan, auto-logout, kartu stok"
   git push
   ```

> File `.env` **tidak akan ikut ter-push** karena sudah masuk `.gitignore` —
> ini sengaja, supaya kredensial Supabase kamu tidak bocor ke publik.

---

## 8. Deploy ke Vercel

1. Buka [vercel.com](https://vercel.com) → login pakai akun GitHub
2. Klik **Add New → Project**
3. Pilih repo GitHub yang baru saja kamu push
4. Vercel otomatis mendeteksi ini project **Vite** — biarkan default:
   - Build Command: `npm run build` (atau `vite build`)
   - Output Directory: `dist`
5. **Sebelum klik Deploy**, buka bagian **Environment Variables**, tambahkan
   dua variabel yang sama seperti di `.env` lokal kamu:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://xxxxxxxxxxxx.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | anon key kamu |

6. Klik **Deploy**, tunggu proses build selesai (± 1 menit)
7. Setelah selesai, Vercel kasih URL live, contoh:
   `https://posm-inventory.vercel.app`

Setiap kali kamu `git push` ke branch `main`, Vercel otomatis build & deploy
ulang — tidak perlu upload manual lagi.

> 📷 Fitur **Scan Stok Keluar** butuh akses kamera, dan browser hanya
> mengizinkan akses kamera di halaman **HTTPS** (atau `localhost` saat
> development). Domain `*.vercel.app` sudah otomatis HTTPS, jadi aman.

---

## 9. Cara Pakai Aplikasi

| Halaman | Admin | Staff Gudang | Frontliner |
|---|---|---|---|
| Dashboard | Ringkasan semua gudang | Ringkasan gudangnya sendiri | Ringkasan gudangnya sendiri |
| Scan Stok Keluar | ✅ (pilih gudang dulu) | ✅ (gudangnya sendiri) | ✅ (gudangnya sendiri) |
| Stok Gudang | Lihat & filter semua gudang | Gudangnya sendiri saja | ❌ (tidak muncul di menu) |
| Input Mutasi | Input untuk gudang manapun | Input gudangnya sendiri | ❌ |
| Transfer Antar Gudang | ✅ | ❌ | ❌ |
| Riwayat Transaksi | Semua gudang | Gudangnya sendiri (+ transfer masuk) | Gudangnya sendiri |
| Master POSM | ✅ | ❌ | ❌ |
| Cetak Barcode | ✅ | ❌ | ❌ |
| Master Gudang | ✅ | ❌ | ❌ |
| Manajemen Pengguna | ✅ | ❌ | ❌ |

**Alur input stok:**
- **Stok Masuk** → menambah jumlah (mis. kiriman dari kantor pusat)
- **Stok Keluar** → mengurangi jumlah (mis. rusak, hilang, dipakai) — juga
  bisa lewat **Scan Stok Keluar**
- **Adjustment** → menetapkan ulang jumlah stok sesuai hasil hitung fisik
  (stock opname) — ini langsung mengganti angka, bukan menambah/mengurangi

**Keamanan sesi:**
- Tombol **Keluar** di sidebar sekarang minta konfirmasi dulu sebelum logout
- Kalau tidak ada aktivitas (klik/scroll/ketik) selama **30 menit**, sistem
  otomatis logout dan mengarahkan kembali ke halaman login

---

## 10. Menambah User Baru

**Cara baru (kalau Edge Function `create-user` sudah di-deploy — Bagian 3):**

1. Login sebagai admin → buka **Manajemen Pengguna**
2. Klik **+ Tambah User**
3. Isi email, password awal, nama, pilih **Role** (`Staff Gudang`,
   `Frontliner`, atau `Admin`), dan **Gudang** (kalau bukan admin)
4. Klik **Buat User** — user langsung aktif dan bisa login

**Cara lama (kalau belum deploy Edge Function):**

1. Buat akun di Supabase Dashboard: **Authentication → Users → Add user**
   (isi email & password, centang "Auto confirm user")
2. Baris profile-nya otomatis muncul (lewat trigger)
3. Login sebagai admin di aplikasi → buka **Manajemen Pengguna**
4. Cari user tadi, isi **Nama**, pilih **Role**, dan (kalau bukan admin)
   pilih **Gudang**
5. Klik **Simpan**

---

## 11. Cetak & Scan Barcode

> **Kenapa formatnya QR code, bukan cuma barcode garis-garis (1D)?**
> Barcode 1D seperti CODE128 didesain untuk scanner laser/CCD khusus yang
> membaca sepanjang satu garis lurus dengan presisi tinggi. Kamera HP biasa
> (berbasis gambar, bukan laser) jauh lebih sulit membaca barcode 1D secara
> konsisten — perlu fokus tajam, jarak & sudut yang pas, pencahayaan bagus.
> QR code (2D) jauh lebih andal buat kamera HP karena memang itu tujuan
> desainnya. Karena itu label yang dicetak sekarang berisi **QR code**
> (dipakai untuk scan lewat kamera HP di halaman Scan Stok Keluar) **dan**
> **barcode CODE128** di bawahnya (cadangan, kalau suatu saat kalian pakai
> alat scanner genggam/laser — alat itu justru lebih bagus untuk 1D).

**Mencetak label (admin):**

1. Buka menu **Cetak Barcode**
2. Pilih item yang mau dicetak (default: semua tercentang) — bagian
   "Pratinjau" di bawah menampilkan tampilan tiap label
3. Klik **⬇ Download PDF** — satu file PDF otomatis terunduh, berisi semua
   item yang dipilih, disusun **2 label berdampingan per baris**, beberapa
   baris ke bawah mengikuti ukuran kertas A4 (otomatis lanjut ke halaman
   berikutnya kalau item-nya banyak). Setiap item punya kotaknya sendiri
   dengan QR code + barcode CODE128 + nama item
4. Print file PDF itu seperti biasa (bisa ke label sticker) lalu tempelkan
   ke fisik barang/POSM

> Beda dengan sebelumnya (yang pakai dialog print browser), sekarang hasilnya
> murni file PDF — jadi tampilannya konsisten di printer manapun dan gampang
> dibagikan/disimpan.

**Scan untuk kurangi stok (semua role):**

1. Buka menu **Scan Stok Keluar**
2. Kalau login sebagai admin, pilih gudang dulu
3. Klik **📷 Scan Barcode** — browser akan minta izin akses kamera, klik **Izinkan**
4. Arahkan kamera HP ke **QR code** di label (bagian atas, bukan garis-garisnya)
5. Setelah terdeteksi, muncul info item + stok saat ini. Di sini ada 2 pilihan:
   - Isi **Jumlah Keluar** → klik **Konfirmasi Keluar** untuk mengurangi stok
   - Atau klik **📄 Download Kartu Stok** untuk langsung mengunduh riwayat
     kartu stok item tersebut di gudang ini, tanpa perlu buka menu Stok Gudang

Tombol download ini juga tersedia untuk role **Frontliner** — jadi mereka
bisa scan/pilih item lalu langsung cek atau simpan kartu stoknya sendiri di
lapangan, tanpa perlu akses ke halaman Stok Gudang.

**Input manual (kalau tidak ada barcode / kamera bermasalah):**

1. Buka menu **Scan Stok Keluar**
2. Klik **✍️ Input Manual**
3. Ketik nama/kode di kolom cari, pilih item dari daftar → klik **Lanjut**
4. Sama seperti alur scan: isi jumlah lalu **Konfirmasi Keluar**, atau klik
   **📄 Download Kartu Stok** untuk mengunduh riwayatnya saja

Ini alur yang sama persis dengan hasil scan (mengurangi stok, tercatat di
riwayat) — cuma cara memilih itemnya beda. Cocok dipakai kalau barcode belum
sempat dicetak/ditempel, atau HP tidak punya kamera yang berfungsi baik.

Karena role **Frontliner** hanya melihat menu Dashboard, Scan, dan Riwayat,
alur kerja mereka jadi sangat sederhana: login → Scan atau Input Manual →
konfirmasi jumlah. Cocok dipakai langsung dari HP di lapangan.

> **Kalau kamera tidak muncul/gagal diakses**, ini urutan pengecekan yang
> paling sering jadi penyebabnya:
> 1. **Izin kamera browser** — cek ikon gembok/info di address bar, pastikan
>    "Camera" di-allow untuk domain aplikasi ini
> 2. **HTTPS wajib** — kamera browser hanya bisa diakses dari halaman HTTPS
>    (domain `*.vercel.app` sudah otomatis HTTPS) atau `localhost` saat
>    development. Kalau kamu buka lewat alamat IP lokal (`http://192.168.x.x`)
>    tanpa HTTPS, kamera **tidak akan bisa diakses** — pakai `localhost` di
>    komputer yang sama, atau akses lewat URL Vercel
> 3. **Kamera dipakai aplikasi lain** — tutup aplikasi kamera/video call lain
>    yang mungkin masih memegang akses kamera
> 4. Kalau tetap gagal, pakai **Input Manual** sebagai alternatif — fungsinya
>    sama, tanpa perlu kamera sama sekali

---

## 12. Cetak Kartu Stok (PDF)

1. Buka menu **Stok Gudang**
2. Cari baris item + gudang yang mau dicetak kartunya
3. Klik **Cetak Kartu Stok** di ujung kanan baris
4. File PDF otomatis terunduh, formatnya mengikuti kartu stok fisik:
   kop perusahaan, nama gudang, kode/nama/satuan barang, lalu tabel
   TGL / NOMOR BUKTI / DARI-KEPADA / MUTASI (MASUK-KELUAR) / SALDO

Kolom **SALDO** dihitung otomatis berdasarkan seluruh riwayat transaksi item
tersebut di gudang itu (termasuk transfer masuk dari gudang lain), diurutkan
dari yang paling lama.

> Nama perusahaan di kop PDF ("PT. FASTRATA BUANA") saat ini di-hardcode di
> `src/lib/kartuStok.js` (variabel `COMPANY_NAME`). Kalau nama perusahaan
> beda, tinggal ubah baris itu.

---

## 13. Troubleshooting

**Login berhasil tapi muncul "Profile belum diset"**
→ Trigger di `02_auth_and_rls.sql` belum dijalankan, atau user dibuat
sebelum trigger ada. Cek tabel `profiles` di Table Editor — kalau baris
usernya tidak ada, tambahkan manual: `id` (samakan dengan user id di
Authentication → Users), `email`, `role`.

**Staff gudang/frontliner login tapi data stok kosong / error**
→ Cek kolom `warehouse_id` di tabel `profiles` untuk user tersebut sudah
diisi (lewat halaman Manajemen Pengguna atau Table Editor).

**Muncul error di console: "Supabase env var belum diisi"**
→ File `.env` belum ada / belum diisi (lokal), atau Environment Variables
belum ditambahkan di Vercel (production). Setelah menambah env var di
Vercel, perlu **Redeploy** supaya perubahan terbaca.

**Data tidak muncul sama sekali padahal sudah login (untuk semua role)**
→ Kemungkinan besar RLS policy dari `02_auth_and_rls.sql` belum dijalankan,
atau ada typo saat menjalankannya. Buka SQL Editor, jalankan ulang file
tersebut, perhatikan kalau ada pesan error merah.

**Transfer masuk tidak muncul di Riwayat/Kartu Stok gudang tujuan**
→ File `04_fix_transfer_rls.sql` belum dijalankan. Jalankan lewat SQL Editor.

**Tombol "Tambah User" gagal / muncul error**
→ Edge Function `create-user` belum di-deploy, atau caller bukan admin.
Cek Bagian 3, lalu cek tab **Logs** di Edge Functions dashboard Supabase
untuk detail error-nya. Sebagai alternatif sementara, pakai cara lama
(Bagian 10) lewat Supabase Dashboard.

**Kamera tidak bisa diakses saat scan**
→ Ini yang paling sering jadi penyebab, cek berurutan:
1. Izin kamera browser belum di-allow (cek ikon gembok di address bar)
2. Diakses lewat `http://` + alamat IP (bukan HTTPS/`localhost`) — browser
   memblokir akses kamera di halaman non-secure. Pakai domain Vercel
   (otomatis HTTPS) atau `localhost` saat development
3. Kamera sedang dipakai aplikasi lain
4. HP tidak mendukung `facingMode: environment` — aplikasi sudah otomatis
   fallback ke kamera lain yang tersedia, tapi kalau tetap gagal, pakai
   tombol **✍️ Input Manual** sebagai alternatif (tidak butuh kamera sama
   sekali)

**Nomor Bukti/kolom baru tidak muncul di form**
→ File `03_nomor_bukti.sql` belum dijalankan, jalankan lewat SQL Editor.

**Build gagal di Vercel**
→ Buka tab **Deployments → (deployment yang gagal) → Build Logs** di
Vercel, baca pesan error-nya — biasanya karena ada typo di kode atau env
var belum lengkap.

**Ingin ubah warna/branding**
→ Edit `tailwind.config.js` bagian `colors.brand`, lalu warna di seluruh
aplikasi otomatis berubah (karena semua komponen pakai class `brand-*`).
