# Google Calendar dua arah

Integrasi tersedia di halaman utama Snoomy. Belum aktif sampai variabel OAuth dipasang. Tidak memerlukan perubahan database manual: tabel tambahan dibuat otomatis saat server mulai, tanpa mengubah jadwal, tugas, atau budgeting lama.

## Setup sekali oleh Moreno

1. Buka [Google Cloud Console](https://console.cloud.google.com/), buat/pilih project untuk Snoomy. Tidak perlu mengaktifkan free trial atau membeli layanan hosting Google.
2. Di APIs & Services, aktifkan **Google Calendar API**.
3. Buka Google Auth Platform. Isi nama aplikasi **Snoomy**, email support dan kontak developer milikmu. Pilih audience External. Untuk awal, gunakan Testing dan tambahkan alamat Google Moreno serta Cahya sebagai test users.
4. Di Data Access, tambahkan scope `https://www.googleapis.com/auth/calendar.app.created`. Aplikasi hanya mengakses kalender sekunder yang dibuatnya. Tidak perlu scope seluruh kalender atau Google Tasks.
5. Buat OAuth client tipe **Web application**. Authorized redirect URI harus tepat:

   `https://snoomy.vercel.app/google/callback`

6. Simpan variabel berikut di Vercel > Snoomy > Settings > Environment Variables, untuk **Production**:

   - `GOOGLE_CLIENT_ID`: client ID dari Google.
   - `GOOGLE_CLIENT_SECRET`: client secret dari Google.
   - `GOOGLE_REDIRECT_URI`: URL callback di atas.
   - `GOOGLE_TOKEN_ENCRYPTION_KEY`: kunci acak 32 byte dalam base64. Buat sekali di terminal privat: `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`.

   Jangan masukkan client secret atau kunci enkripsi ke GitHub, screenshot, atau chat. Simpan kunci enkripsi tetap sama antar-deployment. Mengganti kunci membuat token lama tidak terbaca sampai akun dihubungkan ulang.

7. Redeploy. Masuk Snoomy sebagai Moreno, klik **Hubungkan Google Calendar**, pilih akun Moreno dan izinkan scope yang diminta. Cahya mengulang dari profil Cahya dengan akun sendiri. Keduanya harus memberi izin sendiri. Klik **Sinkronkan sekarang** untuk membuat kalender dan mengirim data pertama.

Untuk localhost gunakan OAuth client terpisah dengan redirect `http://localhost:3000/google/callback`. Jangan memakai kredensial production untuk deployment preview yang tidak dipercaya.

## Cara kerjanya

- Kalender khusus **Snoomy · Moreno** dan **Snoomy · Cahya**. Kalender utama tidak dibaca/diubah.
- Hanya jadwal pemilik profil, tugas miliknya, dan tugas Berdua yang dikirim. Budgeting tidak dikirim.
- Kuliah menjadi seri mingguan WIB tanpa tanggal akhir, sesuai model jadwal Snoomy. Edit seluruh seri di Google. Acara berulang dengan pengecualian, tanggal akhir, beberapa hari per minggu, zona waktu selain Asia/Jakarta, atau durasi lintas hari tidak dapat dipetakan dan ditampilkan sebagai peringatan.
- To-do menjadi acara **seharian satu tanggal**, bukan Google Tasks. Edit judul/deadline dua arah. Prefix `[Selesai] ` pada judul berarti checklist selesai; hapus prefix untuk membuka lagi. Prioritas dan assignee tetap diubah di Snoomy. Deskripsi kuliah adalah nama dosen dan lokasi adalah ruangan.
- Acara baru berformat kompatibel di kalender khusus diimpor sebagai tugas/jadwal milik profil itu.
- Menghapus acara terhubung menghapus item Snoomy, termasuk tugas Berdua. Penghapusan lokal ikut ke Google. Konflik edit tidak ditimpa: pengguna memilih versi di panel. Untuk konflik edit vs hapus, hanya penghapusan yang bisa diterima; salin teks versi yang ingin dipertahankan lalu buat item baru bila diperlukan.
- Sinkron tiap menit **selama halaman utama terbuka**, saat membuka kembali, setelah edit lokal, atau melalui tombol. Tidak ada job background saat semua halaman ditutup. Tugas Berdua menyusul di akun kedua saat profil itu menyinkronkan.
- Putus koneksi menghapus token lokal tetapi mempertahankan kalender dan mapping, sehingga sambung ulang dengan akun Google yang sama tidak menduplikasi acara. Cabut izin server di pengaturan keamanan akun Google bila diperlukan. Beralih akun atau menghapus kalender khusus memerlukan reset mapping oleh pengelola, bukan otomatis membuat salinan baru.

## Biaya dan izin

Google menerapkan kuota API. Pemakaian dua orang jauh di bawah ambang harian yang dipublikasikan, tetapi kuota dan ketentuan layanan tetap berlaku. Periksa [batas pemakaian resmi](https://developers.google.com/workspace/calendar/api/guides/quota) sebelum menambah pengguna. Setup ini tidak mengaktifkan billing atau layanan berbayar.

Pada OAuth External dengan status **Testing**, refresh token scope Calendar umumnya kedaluwarsa setelah **7 hari**. Jika izin berakhir, klik Hubungkan ulang. Untuk penggunaan jangka panjang, lihat persyaratan Google sebelum mengubah status ke Production; kebutuhan verifikasi bergantung pada scope dan konfigurasi aplikasi. Jangan menganggap semua aplikasi otomatis terverifikasi.

Referensi: [OAuth web server](https://developers.google.com/identity/protocols/oauth2/web-server), [masa berlaku token](https://developers.google.com/identity/protocols/oauth2#expiration), [scope Calendar](https://developers.google.com/workspace/calendar/api/auth).

## Pengujian dan batas implementasi

`npm test` menguji SQLite dan PostgreSQL, konversi event, CRUD dua arah, mapping shared task, konflik, compare-and-swap saat ada edit bersamaan, pengecualian seri, pagination, retry ekspor, kunci sinkronisasi, dan enkripsi. Tes Google memakai API tiruan; uji OAuth akun sungguhan perlu kredensial dan persetujuan pemilik akun.

Token disimpan terenkripsi AES-256-GCM di database. OAuth memakai state sekali pakai, PKCE, cookie browser khusus, dan pemeriksaan sesi Snoomy yang memulai koneksi. Google write memakai ETag/If-Match; perubahan lokal dari Google memakai compare-and-swap. Lease database mencegah dua worker menyinkronkan bersamaan. Daftar acara dibaca lengkap dengan pagination karena kalender ini kecil; tidak memakai sinkronisasi kalender pribadi atau webhook.

Jika Google timeout, sebagian item mungkin sudah selesai. Klik sinkronkan lagi. Mapping dan ID event deterministik mencegah duplikasi ekspor. Pembuatan kalender pertama belum memiliki idempotency key di API Google: timeout pada respons pembuatan kalender dapat meninggalkan kalender kosong tambahan, yang dapat dihapus manual setelah memastikan kalender aktifnya.
