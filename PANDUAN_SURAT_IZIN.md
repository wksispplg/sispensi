# Surat izin PDF dan pemindai QR

## Siswa

1. Ajukan izin dan tunggu persetujuan guru.
2. Buka **Riwayat Pengajuan**, lalu detail pengajuan yang sudah disetujui.
3. Klik **Unduh Surat Izin (PDF)**. File berisi kop Telkom Schools, nomor surat,
   identitas siswa, jenis/alasan/tanggal/rentang jam pelajaran, serta persetujuan guru.
4. Tunjukkan QR di PDF kepada guru. PDF dapat dicetak atau ditampilkan di HP.

Data surat diambil dari pengajuan dan keputusan guru yang tersimpan, termasuk
nama guru serta waktu persetujuannya. Surat tidak menampilkan tanda tangan
tulisan tangan atau stempel rekaan. Waktu menggunakan zona **Asia/Jakarta (WIB)**.
Alasan panjang dibungkus mengikuti margin; jika diperlukan, surat dilanjutkan
ke halaman berikutnya tanpa menghilangkan isi.

PDF selalu dibuat ulang saat diunduh. Salinan lama yang kosong atau memakai
URL QR lama tidak digunakan kembali. Pengajuan yang belum disetujui, ditolak,
atau dibatalkan tidak dapat mengunduh surat persetujuan.

## Guru dan admin

1. Login menggunakan akun Guru Mapel, Wali Kelas, Guru BK, atau Administrator.
2. Buka menu **Scan QR Surat**.
3. Klik **Nyalakan kamera**, lalu izinkan kamera di browser dan arahkan ke QR
   pada surat siswa. Kamera tidak dinyalakan otomatis saat halaman dibuka.
4. Alternatif: **Unggah gambar QR** (JPG/PNG/WebP, maksimal 10 MB), atau masukkan
   tautan/token surat. Untuk PDF, unggah tangkapan layar atau foto bagian QR-nya.
5. Cocokkan nama, kelas, waktu izin, dan status. Gunakan **Periksa ulang status**
   untuk memperbarui hasil pemeriksaan.

Hasil menampilkan persetujuan dan rentang jam izin. Jadwal yang belum dimulai
atau sudah berakhir diberi keterangan. Fitur pemantauan keluar/kembali dan timer
sudah dihapus. Pemindaian QR hanya memeriksa surat, tanpa mengubah pengajuan.

Gambar diolah di perangkat, bukan diunggah ke penyimpanan sekolah. Pemindai
hanya menerima token atau tautan verifikasi dari origin aplikasi yang sesuai;
hasil QR tidak digunakan untuk membuka situs asing.

QR juga dapat dipindai memakai aplikasi kamera HP biasa. Tautannya membuka
halaman verifikasi publik dengan data minimum, tanpa alasan izin, NIS, atau
bukti pendukung. Nama, kelas, dan rentang jam pada hasil scan harus sesuai
dengan surat yang ditunjukkan siswa.

## Konfigurasi saat deploy

- Isi `NEXT_PUBLIC_APP_URL` dengan URL website yang dipakai siswa/guru, misalnya
  `https://sipensi.nama-sekolah.sch.id`, kemudian deploy ulang. Jangan gunakan
  `localhost` untuk deployment publik. Ini menjadi alamat pada QR surat.
- Gunakan **HTTPS** agar kamera dapat digunakan dari HP. `localhost` dapat
  digunakan untuk pengembangan di laptop yang sama. Alamat LAN HTTP biasa
  seperti `http://192.168.x.x:3000` tidak menyediakan akses kamera di banyak browser.
- `SUPABASE_SERVICE_ROLE_KEY` tetap hanya di server. Ini diperlukan untuk
  pembuatan surat dan pembacaan terbatas melalui token verifikasi.
- Tidak diperlukan database atau tabel baru. Gunakan Supabase proyek yang sudah ada.
- Jalankan `supabase/migrations/0014_period_range.sql` setelah migrasi 0013.
  Pembaruan ini menyimpan jam awal/akhir dan menonaktifkan API timer lama.
- Logo lokal berada di `public/branding/telkom-schools.png`; pastikan folder
  `public` ikut pada deployment, termasuk jika memakai paket standalone.

Halaman verifikasi membaca data surat secara langsung di server, sehingga
tidak bergantung pada keberadaan RPC `verify_letter` dari migrasi lama.
Pembacaan PDF siswa tetap melalui pemeriksaan akses RLS sebelum proses
pembuatan surat di server.

## Pemeriksaan pengembangan

```powershell
node --test tests/surat.test.mjs tests/chatbot.test.mjs tests/lesson-periods.test.mjs tests/routing-sql.test.mjs tests/rekap.test.mjs
npm run lint
npx tsc --noEmit
npm run build -- --webpack
```

Tes menggunakan data fiktif dan tidak menyetujui pengajuan di database sekolah.
Uji kamera fisik dilakukan dari browser/perangkat berkamera melalui HTTPS atau
localhost, dengan izin kamera diberikan langsung oleh pengguna perangkat.

Sumber logo/kontak sekolah dicatat di `public/branding/SOURCES.md`. Pustaka
pembaca QR menggunakan [jsQR](https://github.com/cozmo/jsQR).
