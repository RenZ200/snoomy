# Jadwal kuliah dari SIAP / Gentayu

Snoomy bisa mengisi jadwal kuliah Moreno dan Cahya dari SIAP atau Gentayu. Login SSO tetap dilakukan sendiri di SIAP/Gentayu. Snoomy tidak pernah meminta, menerima, atau menyimpan password SSO.

## Cara pakai (masing-masing untuk jadwalnya sendiri)

1. Login sendiri di **SIAP** (siap.undip.ac.id) atau buka **Gentayu**.
2. Di SIAP buka **Dasbor → Jadwal Kuliah** (TA berjalan). Blok tabel jadwal mulai dari judul kolom *No* sampai baris terakhir, lalu salin (Ctrl+C). Kolom Hadir/Aksi boleh ikut tersalin. Bisa juga simpan sebagai file JSON / CSV / TXT.

   Sudah dicoba dengan tabel SIAP asli (2026/2027 Ganjil): 10 dari 10 kelas terbaca benar. Tabel SIAP web tidak memuat nama dosen, jadi kolom dosen kosong kecuali diisi manual.
3. Di Snoomy, buka tab **Jadwal**, tekan **Impor SIAP**.
4. Tempel teksnya atau tekan **Pilih file…**, lalu **Cek dulu**.
5. Lihat pratinjau: **Baru**, **Berubah** (dengan nilai sebelumnya), **Dihapus**. Tekan **Simpan ke Snoomy**.

Ulangi langkah ini tiap awal semester, atau saat ada pengumuman pindah ruang/jam. Kelas yang sama tidak akan dobel.

## Sinkron otomatis (laptop)

Pasang ekstensi **Snoomy × SIAP** dari folder `extension/snoomy-siap` (panduan di README-nya). Setelah token disambungkan, kamu cukup login SSO di SIAP; jadwal terkirim ke Snoomy sendiri tanpa salin-tempel. Status kiriman terakhir terlihat di Snoomy (Impor SIAP → Sinkron otomatis) dan di ikon ekstensi.

## Format yang bisa dibaca

- **JSON dari SIAP**: baris berisi `hari`, `waktu_mulai`, `waktu_selesai`, `kode_mk`, `nama_mk`, `nama_kelas`, `nama_ruang`, `nama_dosen`, `tanggal_pertemuan` (boleh bersarang, misalnya di dalam `data`). Daftar pertemuan per tanggal otomatis diringkas jadi satu jadwal mingguan.
- **Tabel salinan** (dipisah tab, titik koma, atau koma) dengan baris judul, misalnya `Kode | Mata Kuliah | Kelas | Hari | Jam | Ruang | Dosen`.
- **Teks bebas**, satu kelas per baris:
  ```
  Senin 07:00-09:30 Termodinamika | A.502 | Dr. Nama Dosen
  Rabu
  10.00 – 12.30 TKK21302 Perpindahan Panas · Ruang B.201
  ```
  Nama hari boleh di setiap baris atau sebagai judul di atas beberapa baris.

Jadwal ujian (UTS/UAS) dilewati. Maksimal 80 kelas per impor.

## Aturan aman

- Impor hanya mengubah jadwal bertanda **SIAP** milik orang yang sedang login. Jadwal yang ditambah manual (asistensi, organisasi, dll.) tidak pernah diubah atau dihapus.
- Matkul SIAP yang tidak ada lagi di data baru akan dihapus. Hilangkan centang "Hapus matkul SIAP yang sudah tidak ada" kalau data yang ditempel cuma sebagian.
- Jadwal SIAP tetap bisa diedit/dihapus manual. Impor berikutnya akan mengikuti data SIAP lagi.
- Jadwal hasil impor ikut tersinkron ke Google Calendar seperti jadwal biasa.

## Teknis

- Parser: `undip-import.js` (nama field mengikuti skema app SIAP `com.undip.siap`).
- Endpoint: `POST /api/undip/preview` dan `POST /api/undip/import` (`{ text, keepMissing }`), butuh sesi Snoomy. Token: `GET|POST|DELETE /api/undip/token` (sesi). Ekstensi: `POST /api/undip/push` dengan `Authorization: Bearer snm_…` (tanpa cookie, batas 1 kiriman/30 detik). Tabel `sync_tokens` hanya menyimpan hash SHA-256 token.
- Penanda sumber: tabel `schedule_sources` (dibuat otomatis, tabel `schedules` tidak diubah).
- Tes: `test/undip-import.test.js`, `test/undip-routes.test.js`, `test/undip-postgres.test.js`.
