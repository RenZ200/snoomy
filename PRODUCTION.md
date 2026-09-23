# Catatan produksi

Nama pilihan: Snoomy. Arah visual: meja belajar di matcha cafe, header plum gelap, kartu cream, identitas Moreno matcha dan Cahya pink. Judul Fredoka dan body Nunito, dekorasi comic kecil, ilustrasi cup orisinal SVG editable. Semua warna utama berasal dari brief.

Permintaan app fungsional terbaru menjadi acuan. Tidak ada pinned scroll cinematic atau video generatif: ilustrasi CSS/SVG sesuai instruksi khusus user dan app harian tetap cepat digunakan. Tidak menggunakan generator gambar/video, aset karakter, atau prompt generatif. Master logo: `public/mascot.svg`. Design board menggunakan stylesheet yang sama: `public/style-tile.html`.

Data tersimpan di server, polling 10 detik, sesi 24 jam, layout tujuh kolom dengan scroll horizontal di layar sempit. Dialog menggunakan HTML native untuk fokus dan keyboard. Reduced-motion mematikan animasi/transisi. HTML formulir dan konten tetap selectable dan editable.

## Verifikasi

- `npm install`: berhasil, audit melaporkan 0 vulnerability saat instalasi.
- `node --check` backend/frontend: berhasil.
- `npm test`: lulus. Memeriksa PIN salah, sesi, akses tanpa login, kepemilikan jadwal, validasi waktu/tanggal, CRUD, perubahan tugas oleh profil lain, dan persistensi setelah restart proses server.
- Browser: login Moreno, simpan tugas, checklist, filter selesai, simpan jadwal, dan kemunculan jadwal di dashboard/kalender berhasil. Data sementara pengujian dibersihkan.
- Layout diperiksa pada viewport desktop 1366×900 dan mobile 390×844. Mobile memiliki lebar halaman 375px pada viewport 390px (ruang scrollbar 15px), tanpa overflow halaman horizontal. Kalender sengaja dapat digeser sendiri.
- Tampilan menggunakan SVG lokal dan Google Fonts yang berhasil dimuat saat pemeriksaan. Tidak ada build frontend karena source disajikan langsung.

Belum diuji dari laptop kedua melalui WiFi sungguhan, HP fisik, atau tunnel internet. Tidak ada deployment publik. Reduced-motion disediakan melalui media query, belum diuji dengan pengaturan OS. PIN tidak aktif pada startup default; panduan aktivasi ada di README.

## Pembaruan hosting gratis

Backend mendukung Neon PostgreSQL via DATABASE_URL. Render Blueprint memilih Free. Dua tes lulus: API/persistensi lokal SQLite dan CRUD/constraint PostgreSQL melalui PGlite. Koneksi Neon/Render sungguhan serta migrasi data aktual belum diuji karena akun belum terhubung. File SQLite dan proses lokal yang sedang berjalan tidak diubah oleh migrasi kode. Lihat DEPLOY-FREE.md.
