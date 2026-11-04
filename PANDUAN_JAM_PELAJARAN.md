# Perbaikan pengajuan Lapis 1 dan pilihan jam pelajaran

## Yang diperbaiki

- Guru BK sekarang melihat pengajuan Lapis 1/2 yang ditugaskan kepadanya,
  selain antrian Lapis 3. Sebelumnya daftar Guru BK hanya menampilkan Lapis 3.
- Form siswa memakai pilihan **dari jam pelajaran sampai jam pelajaran**
  (1-11), untuk **hari ini di WIB**. Jam akhir tidak boleh sebelum jam awal.
- Nama guru Lapis 1 mengikuti jadwal pada jam awal. Rentang lengkap disimpan
  dan ditampilkan pada detail, PDF, hasil verifikasi QR, serta rekap.
- Pemantauan Dispen, timer, dan tombol mulai/kembali sudah dihapus.
- Pratinjau menampilkan nomor jam sekolah, bukan nomor urut baris jadwal guru.
- Jadwal admin memakai jam pelajaran awal/akhir yang sama dengan form siswa.
- Pengajuan tanpa kelas atau tanpa guru/wali kelas yang tersedia ditolak
  dengan pesan yang jelas, sebelum bukti diunggah.
- Trigger database memilih guru berdasarkan `requested_at` (waktu izin),
  bukan `created_at` (waktu pengajuan dikirim).

| Jam ke- | Waktu (WIB) |
| --- | --- |
| 1 | 07.10-07.50 |
| 2 | 07.50-08.30 |
| 3 | 09.00-09.40 |
| 4 | 09.40-10.20 |
| 5 | 10.20-11.00 |
| 6 | 11.00-11.40 |
| 7 | 11.40-12.20 |
| 8 | 13.20-14.00 |
| 9 | 14.00-14.40 |
| 10 | 14.40-15.20 |
| 11 | 15.20-16.00 |

Slot tanpa nomor pada contoh (07.00-07.10, 08.30-09.00, dan 12.20-13.20)
tidak dijadikan pilihan jam pelajaran.

## Pembaruan Supabase yang perlu dijalankan

Gunakan project Supabase yang sudah disediakan pemilik. **Tidak perlu membuat
database baru.** Pembaruan trigger belum aktif sebelum SQL berikut dijalankan.

1. Buka project Supabase yang sama dengan konfigurasi aplikasi.
2. Buka **SQL Editor**, lalu **New query**.
3. Buka `supabase/migrations/0013_route_by_requested_period.sql` di project ini.
4. Salin seluruh isi file, tempel ke SQL Editor, lalu **Run**.
5. Selanjutnya jalankan seluruh isi `supabase/migrations/0014_period_range.sql`
   untuk menyimpan rentang jam dan menghapus API timer. Jika 0013 sudah pernah
   dijalankan, cukup jalankan 0014 untuk perubahan terbaru ini.
6. Jalankan/update aplikasi dan muat ulang halaman siswa serta guru.

Data pengajuan lama dipertahankan. Jam akhir tidak ditebak atau diisi otomatis
untuk surat lama yang sebelumnya hanya memiliki waktu mulai.

Migrasi aman dijalankan ulang. Migrasi juga menyesuaikan penanggung jawab
pengajuan yang masih menunggu di Lapis 1 jika berbeda dengan guru pada waktu
izin. Pengajuan yang sudah disetujui, ditolak, atau sudah naik lapis tetap
dipertahankan. Jika guru tujuan berubah, penerima yang benar mendapat notifikasi
dan jangka waktu tanggapan baru. Pengajuan tanpa data jadwal/wali yang lengkap
tidak dipindahkan ke guru secara acak.

Sumber panduan fungsi database:
[Supabase Database Functions](https://supabase.com/docs/guides/database/functions).

## Periksa data jadwal yang sudah ada

Pilihan jam siswa tidak mengubah guru yang tercatat pada jadwal. Di akun Admin,
buka **Jadwal Pelajaran** dan pastikan kelas, hari, mata pelajaran, serta guru
sudah sesuai dengan jam sekolah di atas. Perbaiki rentang jadwal lama yang
belum sesuai melalui data master; rentang lama tidak digeser otomatis karena
guru dan mata pelajaran yang benar harus mengikuti jadwal sekolah.

Jika tidak ada jadwal guru pada jam yang dipilih, pengajuan diarahkan ke wali
kelas yang ditetapkan pada kelas siswa. Akun Guru BK yang ditugaskan mengajar
atau menjadi wali kelas tetap dapat menjadi penerima di Lapis 1.

## Coba alur setelah pembaruan

1. Login siswa dan pilih jam awal serta jam akhir. Cocokkan nama di **Penanggung jawab**.
2. Isi alasan dan lampiran, lalu kirim pengajuan.
3. Login guru yang tercantum tadi, buka **Perlu Persetujuan**, lalu muat ulang.
4. Pastikan pengajuan muncul sebagai **Lapis 1**. Ini juga berlaku jika akun
   guru tersebut berperan sebagai Guru BK.
5. Setujui/tolak pengajuan seperti biasa; surat dan QR tetap mengikuti alur yang ada.

## Uji pengembangan

```powershell
npm ci
node --test tests/lesson-periods.test.mjs tests/routing-sql.test.mjs tests/surat.test.mjs tests/chatbot.test.mjs
npm run lint
npx tsc --noEmit
npm run build -- --webpack
```

Uji SQL memakai PostgreSQL lokal di memori melalui PGlite, sehingga tidak
membuat atau mengubah pengajuan di database sekolah. Pembaruan Supabase di
SQL Editor tetap diperlukan untuk memakai trigger yang baru di aplikasi asli.
