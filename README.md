# Snoomy

**Hosting:** panduan terbaru ada di [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md) untuk Vercel Hobby + Neon Free. Backend memakai PostgreSQL saat DATABASE_URL terisi, atau SQLite untuk mode lokal.

App privat untuk jadwal kuliah dan tugas Moreno & Cahya. Node.js + Express, SQLite lokal, HTML/CSS/JavaScript tanpa framework. Semua source sudah lengkap di folder ini, tidak memerlukan build frontend.

## Struktur proyek

```text
WEBISTE/
├── package.json
├── package-lock.json
├── server.js
├── schema.sql
├── .env.example
├── .gitignore
├── README.md
├── PRODUCTION.md
├── public/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── mascot.svg
│   └── style-tile.html
├── test/
│   └── app.test.js
└── data/                 # otomatis dibuat saat server dijalankan
    └── matcha-duo.sqlite # serta file SQLite -wal/-shm ketika aktif
```

## Install dan jalankan

Install **Node.js 24 atau lebih baru**. SQLite memakai modul bawaan `node:sqlite`, jadi tidak perlu server database, Python, atau compiler native. Node mungkin menampilkan peringatan status eksperimental SQLite; itu bukan kegagalan.

Buka terminal di folder proyek:

```sh
npm install
npm start
```

Buka http://localhost:3000. Pilih Moreno atau Cahya. Data awal sengaja kosong. Buat jadwal sendiri dan tugas untuk salah satu atau berdua. Perubahan dari laptop lain diambil setiap 10 detik ketika tab aktif dan formulir edit tertutup.

Jalankan pemeriksaan backend dengan `npm test`. Tidak ada proses `npm run build` karena frontend disajikan langsung oleh Express.

## PIN opsional

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Mac/Linux: `cp .env.example .env`. Edit `.env` lalu restart server:

```dotenv
PORT=3000
DB_PATH=./data/matcha-duo.sqlite
MORENO_PIN=1234
CAHYA_PIN=5678
COOKIE_SECURE=false
```

Ganti contoh PIN tersebut dengan PIN kalian sendiri. Keduanya kosong berarti pemilihan nama tanpa autentikasi, untuk WiFi pribadi. PIN disetel di file konfigurasi laptop server, bukan dari browser. Gunakan PIN keduanya sebelum membuka tunnel atau hosting. PIN 4 digit tetap proteksi sederhana, bukan autentikasi untuk data sensitif. Percobaan salah dibatasi 8 kali per 5 menit per profil, dibagi semua perangkat. Cookie sesi HttpOnly berlaku 24 jam. Sesi dan data tetap ada setelah server restart.

## Akses dari laptop Cahya di WiFi yang sama

1. Sambungkan dua laptop ke WiFi yang sama. Server sudah mengikat host **0.0.0.0** di `server.js`.
2. Jalankan `npm start` di laptop Moreno dan biarkan terminal serta laptop tetap hidup.
3. Cari IP lokal laptop Moreno:
   - Windows: `ipconfig`, lihat **IPv4 Address** adaptor Wi-Fi, misalnya `192.168.1.10`.
   - Linux: `ip addr`, lihat alamat `inet` adaptor WiFi.
   - macOS: `ifconfig` atau `ipconfig getifaddr en0`.
4. Cahya membuka **http://192.168.1.10:3000**, ganti IP sesuai hasil tadi. Jangan memakai `localhost` di laptop Cahya karena itu menunjuk laptopnya sendiri.
5. Jika Windows menampilkan izin firewall Node.js, izinkan pada jaringan **Private**. Bila diblokir, buat aturan inbound TCP port 3000 hanya untuk profil Private/jaringan lokal. Tidak perlu mematikan firewall.

Guest WiFi, client isolation, atau VPN dapat menghalangi koneksi antarperangkat. IP lokal bisa berubah setelah reconnect. `0.0.0.0` adalah alamat bind server, bukan alamat untuk dibuka di browser. Kedua laptop berbagi database di server Moreno; tidak perlu menyalin database ke laptop Cahya.

## Beda jaringan/kota: tunnel opsional

Aktifkan PIN kedua profil. Ubah `COOKIE_SECURE=true` dan restart jika akses memakai HTTPS tunnel. Dengan pengaturan ini, gunakan URL HTTPS tunnel di kedua laptop, karena cookie secure tidak dikirim melalui HTTP IP lokal. Untuk kembali memakai HTTP LAN, set false dan restart.

Pilihan ngrok:

```sh
ngrok config add-authtoken TOKEN_DARI_AKUN_NGROK
ngrok http 3000
```

Install ngrok dan ambil token dari akunmu. Bagikan alamat HTTPS yang ditampilkan hanya kepada Cahya. [Panduan ngrok](https://ngrok.com/docs/start).

Alternatif Cloudflare Quick Tunnel, setelah install `cloudflared`:

```sh
cloudflared tunnel --url http://localhost:3000
```

Buka URL HTTPS `trycloudflare.com` yang muncul. Quick Tunnel untuk pengujian, URL bersifat sementara dan dapat berubah setelah restart. [Panduan resmi](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/).

Tunnel tetap memerlukan laptop, server, dan proses tunnel menyala. Tidak ada tunnel atau deployment publik yang dibuat otomatis oleh proyek ini.

## Hosting tanpa laptop terus menyala

Upload source ke repositori privat, jangan unggah `.env` atau folder `data`. Gunakan Node 24, build command `npm ci`, start command `npm start`, serta satu instance aplikasi.

- **Railway:** deploy repositori, tambahkan persistent volume dengan mount `/data`, set `DB_PATH=/data/matcha-duo.sqlite`, kedua PIN, dan `COOKIE_SECURE=true`, lalu aktifkan domain HTTPS. Railway memiliki trial/free credit terbatas; jangan menganggap hosting aplikasi 24/7 gratis tanpa batas. [Ketentuan terbaru](https://docs.railway.com/pricing/free-trial).
- **Render:** SQLite persisten membutuhkan layanan berbayar dengan persistent disk, misalnya mount `/var/data` dan `DB_PATH=/var/data/matcha-duo.sqlite`. **Render Free tidak mendukung persistent disk**; database pada filesystem lokal hilang saat restart/redeploy/spin-down. Jangan deploy versi SQLite ini ke Render Free untuk menyimpan data penting. [Render Free](https://render.com/docs/free), [persistent disk](https://render.com/docs/disks).

Jadi opsi gratis paling sederhana yang mempertahankan arsitektur ini adalah laptop + tunnel, dengan laptop tetap hidup. Hosting gratis permanen mungkin membutuhkan perubahan database ke layanan eksternal dan penyesuaian kode.

## Edit dan backup

- Copy/layout: `public/index.html`; teks dan perilaku dinamis: `public/app.js`.
- Semua warna dan font: CSS variables di awal `public/style.css`.
- Logo editable: `public/mascot.svg`. Style tile: http://localhost:3000/style-tile.html.
- Jadwal/tugas diubah melalui app, tersimpan di SQLite, bukan localStorage.
- Backup: hentikan server dengan Ctrl+C, lalu salin **seluruh folder data** ke folder backup terpisah. Jangan menghapus file `-wal` saat server aktif. Untuk restore, hentikan server lalu pulihkan folder backup. Jika `DB_PATH` diubah, backup direktori yang berisi database tersebut.
- Hindari menyalakan dua proses server terhadap file DB yang sama. Untuk pemakaian rutin, simpan proyek/database di folder lokal yang tidak disinkronkan OneDrive agar sinkronisasi file tidak mengganggu SQLite.

## Asumsi

- Jadwal berulang setiap minggu, Senin sampai Minggu, tidak ada pengecualian/libur semester.
- Semua waktu ditafsirkan sebagai WIB, termasuk dashboard dan perhitungan hari deadline.
- Deadline berupa tanggal tanpa jam. Hari ini, besok, dan tugas terlambat diberi penanda; dashboard menampilkan maksimal 4 tugas terdekat sampai 3 hari ke depan, termasuk yang terlambat.
- Bentrok berarti dua interval jadwal beririsan pada hari yang sama, termasuk jadwal pemilik yang sama. Jadwal berakhir tepat saat jadwal lain mulai tidak dianggap bentrok.
- Hanya pemilik yang dapat edit/hapus jadwalnya. Tugas dapat dikelola keduanya. Edit bersamaan memakai perubahan terakhir yang tersimpan.
- Font Google Fonts membutuhkan internet; font sistem menjadi fallback saat offline. Tidak ada SSO/SIAKAD, data contoh palsu, tracking, atau karakter berlisensi.

## Google Calendar dua arah

Panel Google Calendar tersedia di halaman utama. Panduan aktivasi OAuth, cara sinkron, biaya/kuota, dan batasan: [GOOGLE-CALENDAR.md](GOOGLE-CALENDAR.md). Koneksi belum aktif sebelum kredensial server dipasang.
