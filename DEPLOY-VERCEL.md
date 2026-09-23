# Hosting Snoomy: Vercel Hobby + Neon Free

Menggantikan rencana Render karena akun pengguna meminta verifikasi kartu kredit. Tidak ada paket berbayar yang diaktifkan.

## Langkah berikutnya

1. Buka https://vercel.com/signup dan pilih akun personal **Hobby**, bukan trial Pro. Lanjutkan login GitHub. Selesaikan sendiri persetujuan akun/verifikasi jika diminta. Jangan isi kartu atau upgrade paket. Jika verifikasi akun meminta kartu, hentikan dan beri tahu.
2. Import repositori `RenZ200/snoomy`. Jika Vercel meminta akses GitHub, pilih **Only select repositories**, lalu hanya `snoomy`.
3. Framework **Express**, Node.js **24.x**, root direktori proyek. Biarkan build/output memakai default Express. `server.js` mengekspor aplikasi; `public/` disajikan sebagai aset statis.
4. Tambahkan environment variables untuk Production: `DATABASE_URL` (Neon pooled connection), `MORENO_PIN` dan `CAHYA_PIN` (4 digit pilihan kalian), `COOKIE_SECURE=true`, `NODE_ENV=production`. Masukkan kredensial langsung ke dashboard, jangan ke chat atau repositori.
5. Deploy. Setelah status Ready, buka URL produksi `*.vercel.app` dan uji kedua profil. Jangan bagikan URL preview yang masih dibatasi login Vercel.

## Database yang sudah dibuat

- Organisasi Neon: `org-old-heart-44106797`.
- Proyek: `snoomy`, ID `odd-firefly-33593175`.
- Wilayah: AWS Singapore, paket Free sudah terverifikasi pada dashboard.
- Belum ada migrasi data lokal maupun deployment Vercel yang dikonfirmasi.

Untuk data lama, gunakan prosedur `scripts/migrate-to-cloud.js` di DEPLOY-FREE.md setelah database tujuan dan kredensialnya siap. SQLite asli tetap disimpan. Jangan mulai menambahkan data online sebelum migrasi selesai.

## Penyesuaian kode

- Sesi login disimpan di database sebagai hash token, berlaku 24 jam dan dapat dipakai lintas instance. Logout menghapus sesi.
- Batas percobaan login juga di database: maksimal 8 percobaan per profil per 5 menit, dibagi semua perangkat. Login sukses mereset hitungan. Batas ini tetap berlaku ketika server pindah instance.
- Pool PostgreSQL dikelola untuk lifecycle Vercel. Kode tetap dapat dijalankan lokal dengan SQLite.
- Sesi lama dari versi yang menyimpan login di memori memerlukan login ulang sekali saat pembaruan.
- Tes API SQLite dan schema/adapter/auth PostgreSQL dengan PGlite lulus. Build dan integrasi pada Vercel/Neon sungguhan belum diverifikasi.

Vercel Hobby ditujukan untuk penggunaan personal/nonkomersial dengan batas pemakaian. Ketersediaan pendaftaran tanpa kartu pada akun ini belum diverifikasi sampai alur dashboard selesai. Tidak menjanjikan layanan tanpa batas.

Referensi resmi: https://vercel.com/docs/plans/hobby dan https://vercel.com/docs/frameworks/backend/express.
