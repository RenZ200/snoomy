# Snoomy online: GitHub + Render Free + Neon Free

Status: source siap untuk koneksi PostgreSQL; publikasi belum dilakukan. Gunakan akun milik Moreno dan tetap pilih paket Free. GitHub menyimpan source, Render menjalankan Node.js, Neon menyimpan data. Laptop tidak diperlukan setelah deploy berhasil.

## Langkah akun

1. Hubungkan GitHub dan Neon ke percakapan ini untuk melanjutkan bantuan otomatis. Jangan kirim password, PIN, token, atau connection string ke chat.
2. Buat proyek **Neon Free** bernama `snoomy`. Dari menu Connect, salin connection string PostgreSQL (pooled, dengan TLS) langsung ke pengaturan rahasia server.
3. Upload source ke repositori GitHub **private**, misalnya `snoomy`. Jangan unggah `.env`, database, atau ZIP arsip lama. `.gitignore` sudah mengecualikannya.
4. Masuk ke [Render](https://dashboard.render.com/), hubungkan repositori, pilih **New > Blueprint** dengan `render.yaml`. Periksa bahwa layanan memakai **Free**. Jika membuat Web Service manual: runtime Node, build `npm ci --omit=dev`, start `npm start`, Node 24, health path `/health`.
5. Isi variabel lingkungan di Render:

| Nama | Isi |
| --- | --- |
| `DATABASE_URL` | Connection string dari Neon, rahasia, jangan commit |
| `MORENO_PIN` | PIN 4 digit pilihan Moreno |
| `CAHYA_PIN` | PIN 4 digit pilihan Cahya |
| `COOKIE_SECURE` | `true` |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `24` |

6. Deploy, buka alamat HTTPS `*.onrender.com`, lalu uji dengan kedua profil. Tabel dibuat otomatis. Link Render ini dibagikan ke Cahya, tanpa menjalankan tunnel lagi.

Di mode hosting, app menolak startup jika database cloud atau proteksi PIN/cookie belum dikonfigurasi. PIN tetap proteksi sederhana untuk dua orang. Sesi habis setelah 24 jam atau restart server, sehingga mungkin perlu masuk ulang. Jadwal/tugas tetap berada di Neon.

## Menyalin jadwal dan tugas lama

Jangan mulai mengisi data cloud sebelum migrasi. Minta Cahya berhenti mengedit sebentar agar salinan mencakup perubahan terakhir. Data lokal tidak disinkronkan otomatis ke cloud.

Di laptop, simpan `DATABASE_URL` ke `.env` secara lokal, tanpa mengunggahnya. Pemeriksaan awal tidak mengirim data:

```sh
node --env-file=.env scripts/migrate-to-cloud.js
```

Untuk menyalin:

```sh
node --env-file=.env scripts/migrate-to-cloud.js --apply
```

Migrasi memakai satu transaksi, menolak tujuan yang sudah berisi data, dan tidak menghapus SQLite asli. ID internal akan dibuat ulang; isi dan status tugas dipertahankan. Setelah memeriksa jumlah dan isi data cloud, gunakan hanya link Render untuk kedua profil agar tidak ada dua salinan yang berbeda. Simpan backup SQLite lama.

## Batas gratis

- Render Free tidur setelah 15 menit tanpa trafik masuk. Akses pertama sesudah itu bisa lebih lambat. Ada kuota bulanan dan batas layanan, jadi bukan jaminan uptime 24/7. [Ketentuan Render](https://render.com/docs/free).
- Neon Free memiliki kuota penyimpanan dan compute; pilih Free dan pantau penggunaan di dashboard. Jangan mengaktifkan paket berbayar otomatis. [Paket Neon](https://neon.com/pricing).
- Data berada di database eksternal, sehingga tidak bergantung pada filesystem Render. Backup tetap diperlukan.
- Tidak ada pembayaran, akun, repositori remote, atau deployment yang dibuat oleh perubahan file ini.

## Pemeriksaan

`npm test` menguji API SQLite dan adapter/schema PostgreSQL dengan mesin PostgreSQL lokal berbasis PGlite. Pengujian itu tidak menggantikan tes koneksi, TLS, cold start, serta persistensi pada akun Neon/Render sungguhan setelah deploy.
