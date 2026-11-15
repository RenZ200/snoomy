# Snoomy × SIAP (ekstensi Chrome/Edge)

Kirim jadwal kuliah SIAP ke Snoomy otomatis. Kamu cukup login SSO di SIAP seperti biasa; ekstensi membaca tabel **Jadwal Kuliah** dengan sesimu sendiri lalu mengirimnya ke Snoomy.

Ekstensi ini **tidak** membaca, mengisi, atau menyimpan password SSO, dan tidak bisa membuka SIAP sendiri. Sinkron terjadi saat kamu membuka halaman SIAP mana pun di laptop.

## Pasang (sekali, masing-masing di laptop Moreno dan Cahya)

1. Unduh dari Snoomy: **Jadwal → Impor SIAP → Sinkron otomatis → Unduh ekstensi (.zip)**, lalu ekstrak. Simpan foldernya di tempat tetap; Chrome memuat ekstensi dari folder itu.
2. Buka `chrome://extensions` (Edge: `edge://extensions`).
3. Nyalakan **Developer mode** (pojok kanan atas).
4. Klik **Load unpacked**, pilih folder `snoomy-siap` hasil ekstrak (yang berisi `manifest.json`).
5. Sematkan ikon Snoomy di toolbar (ikon puzzle → pin).

Untuk pengembang: setelah mengubah file di `extension/snoomy-siap`, jalankan `node scripts/build-extension.js` agar zip unduhan di `public/downloads/` ikut diperbarui (dicek oleh `test/extension-zip.test.js`).

## Sambungkan ke Snoomy

1. Di Snoomy (login sebagai dirimu): tab **Jadwal → Impor SIAP → Sinkron otomatis → Buat token**, lalu **Salin**.
2. Klik ikon ekstensi, tempel token, **Simpan**.
3. Buka `siap.undip.ac.id`, login SSO. Selesai. Jadwal terkirim di latar; klik ikon ekstensi untuk melihat hasil terakhir, atau **Sinkron sekarang**.

Token Moreno dan Cahya berbeda; jadwal masuk ke pemilik token. Kalau token bocor, **Cabut token** atau buat token baru di Snoomy (token lama langsung mati).

## Cara kerja

- `content.js` jalan di halaman `siap.undip.ac.id`. Paling sering sekali per 10 menit, ia memuat `/jadwal_mahasiswa/mhs/jadwal/` dengan sesimu. Kalau sesi habis (halaman login), tidak ada yang dikirim.
- `siap-table.js` mengambil kolom No, Hari, Matakuliah, Ruangan, Waktu, Sks (persen kehadiran diabaikan).
- `background.js` mengirim ke `POST /api/undip/push` dengan `Authorization: Bearer <token>`, hanya kalau jadwal berubah atau sudah 6 jam sejak kiriman terakhir. Ikon menampilkan **!** kalau kiriman gagal.
- Snoomy menerapkan aturan impor yang sama: tidak dobel, jadwal manual tidak disentuh, matkul SIAP yang hilang dari tabel dihapus.

## Batasan

- Hanya Chrome/Edge di laptop. Chrome di HP tidak mendukung ekstensi; dari HP tetap pakai **Impor SIAP** (salin-tempel).
- Kalau Undip mengubah tampilan tabel Jadwal Kuliah, ekstensi berhenti membaca (ikon **!**, status "Jadwal belum terbaca"). Impor salin-tempel tetap bisa dipakai.
- Membutuhkan Snoomy versi yang sudah punya `/api/undip/push` (sudah di-deploy).
