# 08 Video Teknis SisPensi

Target durasi sekitar 5 menit. Rekam layar dan bacakan bagian **Narasi** sambil memperlihatkan langkah di setiap segmen.

## Persiapan rekaman

- Siapkan VS Code di folder proyek SisPensi, terminal PowerShell, browser, dan aplikasi Postman Desktop.
- Jika dependensi belum terpasang, jalankan `npm install` dari folder proyek. Gunakan konfigurasi Supabase yang sudah disiapkan di `.env.local` dan tutup tab file itu sebelum merekam.
- Untuk bagian setelah login, siapkan akun dan lampiran dummy. Halaman publik dan Postman cukup untuk demo apabila akun uji belum siap.

## 00.00–00.25 · Pembuka

**Di layar** — Tampilkan halaman depan SisPensi dan judul video.

**Narasi**

> Halo, kami dari XII PPLG 4. Ini SisPensi, aplikasi web untuk pengajuan izin siswa SMK Telkom Purwokerto. Siswa bisa mengajukan izin, guru meninjau pengajuan, dan surat yang disetujui bisa diunduh sebagai PDF dengan QR untuk verifikasi.

## 00.25–01.00 · Jalankan aplikasi

**Di layar** — Buka terminal di folder proyek, jalankan perintah berikut, lalu buka alamat yang ditampilkan terminal. Biasanya `http://localhost:3000`.

```powershell
npm run dev
```

**Narasi**

> SisPensi menggunakan Next.js dan TypeScript. Supabase menangani login, database, dan penyimpanan file. Perintah `npm run dev` menjalankan aplikasi secara lokal. Dari browser ini, kita bisa membuka halaman depan dan masuk ke dashboard sesuai peran akun.

## 01.00–02.30 · Jelaskan kode pengajuan

**Di layar** — Buka berkas berikut secara berurutan. Gunakan `Ctrl+F` untuk menemukan bagian yang disebutkan.

1. Buka `src/app/(app)/izin/ajukan/request-form.tsx` dan cari `storage.upload`.

   > Form siswa menerima alasan, rentang jam pelajaran, dan bukti pendukung. Browser mengunggah bukti ke Supabase Storage, lalu mengirim data pengajuan dan lokasi file ke server. Setelah berhasil disimpan, siswa diarahkan ke Riwayat Pengajuan.

2. Buka `src/app/(app)/izin/ajukan/actions.ts` dan cari `createPermissionRequest`.

   > Server memeriksa bahwa pengguna adalah siswa dan data yang dikirim valid. Waktu izin ditentukan dari nomor jam pelajaran dalam WIB. Untuk dispensasi, jam mulai yang sudah berakhir ditolak, termasuk jika jamnya habis sebelum pengajuan sempat disimpan.

3. Buka `supabase/migrations/0013_route_by_requested_period.sql` dan cari `detect_layer1_approver`.

   > Database mencari guru mata pelajaran berdasarkan kelas dan jam mulai izin. Kalau jadwal guru tidak ditemukan, database memakai wali kelas. Ini yang menentukan siapa penerima pengajuan pada tahap pertama.

4. Buka `src/features/surat/pdf.ts` dan cari `generateLetterPdf`.

   > Setelah pengajuan disetujui, modul surat menyusun PDF dari data izin. QR di dalam surat mengarah ke halaman verifikasi.

## 02.30–03.05 · Demo di browser

**Di layar** — Tampilkan halaman depan dan buka asisten SisPensi. Jika akun dummy tersedia, tampilkan juga **Beranda siswa → Ajukan Dispen** dan tunjukkan pilihan jam mulai serta jam selesai.

**Narasi**

> Pada form pengajuan, siswa bisa memilih jam mulai dan selesai dari jam pelajaran sekolah. Di halaman depan, asisten memberi panduan umum tentang cara memakai SisPensi.

Jika hanya menampilkan halaman publik, bacakan kalimat mulai dari “Di halaman depan”.

## 03.05–04.40 · Uji API lewat Postman

**Di layar** — Buka tab HTTP Request di Postman Desktop dan pilih metode **POST**. Masukkan `http://localhost:3000/api/chat`, lalu pilih **Body → raw → JSON**. Jika terminal menampilkan port yang berbeda, sesuaikan port di URL. Biarkan **Authorization** pada **No Auth**.

### Uji 1 · Pertanyaan tentang SisPensi

```json
{"message":"Bagaimana cara mengajukan izin?"}
```

Klik **Send**. Tunjukkan status **200 OK** dan bagian `answer` pada respons.

**Narasi**

> Pertanyaan ini valid. Server mengembalikan status 200 dan panduan pengajuan izin melalui kolom `answer`.

### Uji 2 · Pertanyaan di luar topik

```json
{"message":"Berapa skor pertandingan sepak bola?"}
```

Klik **Send**. Tunjukkan status **200 OK** dan jawaban “Mohon ajukan pertanyaan seputar website SIPENSI saja.”

**Narasi**

> Permintaannya valid, jadi status HTTP tetap 200. Isi respons menunjukkan bahwa asisten membatasi jawaban pada topik SisPensi.

### Uji 3 · Pesan kosong

```json
{"message":""}
```

Klik **Send**. Tunjukkan status **400 Bad Request** dan pesan validasi pada kolom `error`.

**Narasi**

> Kali ini isi pesan kosong. Validasi di `src/app/api/chat/route.ts` menolaknya dan mengembalikan status 400.

Panduan penggunaan Postman Desktop tersedia di [Postman Quick Start](https://learning.postman.com/docs/getting-started/quick-start/).

## 04.40–05.00 · Penutup

**Di layar** — Kembali ke halaman depan atau tampilkan judul SisPensi.

**Narasi**

> Sekian demo teknis SisPensi. Terima kasih.
