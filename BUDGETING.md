# Budgeting Snoomy

Navigasi Budgeting memuat Harian dan Pacaran. Desain memakai variabel warna, font Fredoka/Nunito, tombol, dialog dan radius Snoomy. Peringatan memakai cream latte terang dari palet yang ada, dengan label dan merah saat terlewat; tidak menambah warna brand.

## Pemakaian
- Harian: catat pemasukan/pengeluaran dengan kategori bebas, tanggal dan pemilik. Pilih ringkasan harian/mingguan/bulanan. Saldo adalah arus kas bersih periode, bukan saldo rekening. Minggu dimulai Senin (WIB).
- Budget per kategori berlaku untuk bulan yang dipilih, terlepas dari pencarian/filter riwayat. Menginput budget dengan kategori dan bulan yang sama mengganti budget tersebut. Peringatan muncul mulai 80%, lewat limit di atas 100%.
- Pacaran: jurnal biaya, tempat, catatan dan foto opsional. Satu tanggal dianggap satu kencan saat menghitung rata-rata. Statistik tiga kartu selalu mengikuti bulan; grafik/jurnal mengikuti pilihan periode.
- Semua biaya pacaran dibagi 50–50. Dibayar Moreno berarti Cahya berutang separuhnya dan sebaliknya. Split berarti sudah dibayar rata. Utang dihitung lintas bulan, bukan hanya riwayat yang terlihat. Tidak ada transfer uang atau pencatatan pelunasan terpisah.
- Pengingat tanggal istimewa diulang setiap tahun dan ditandai jika dalam 30 hari. Tanggal 29 Februari mengikuti tahun kabisat berikutnya. Pengingat/alert tampil di aplikasi, bukan notifikasi push ketika browser ditutup.
- Target tabungan diupdate melalui Edit. Tidak otomatis mengubah saldo Harian atau pengeluaran Pacaran.
- Data budgeting dibaca/diedit oleh kedua profil. Foto dikompresi JPEG maksimal 600px, maksimal hasil 280KB teks base64, tersimpan di database yang sama. Foto bukan di layanan eksternal.

## Struktur
- budget.js: router Express dan validasi server.
- budget_records pada schema.sql/schema-postgres.sql: tabel tambahan, data lama tetap utuh.
- public/budget-core.js: perhitungan tanpa DOM.
- public/budget-ui.js: formulir, riwayat, grafik SVG, tabs dan sinkronisasi.
- public/budget.css: layout responsive memakai tokens lama.
- public/nyaa.js: komponen SVG orisinal reusable, renderNyaa(element,mood,variant,hasBudget).
- test/budget.test.js: validasi, perhitungan, API SQLite dan PostgreSQL (PGlite).

Batas awal: data dimuat seluruhnya untuk dua pengguna; banyak foto akan meningkatkan penggunaan penyimpanan dan transfer paket gratis. Tidak ada koneksi bank. Perubahan bersamaan pada catatan yang sama memakai hasil penyimpanan terakhir.
