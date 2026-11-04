# Deploy sementara SIPENSI ke Vercel untuk tes HP

Panduan ini memakai repository proyek dan Supabase yang sudah digunakan.
Database, akun, bukti unggahan, dan pengajuan tetap berada di Supabase yang sama.
Pengujian dari HP juga akan menyimpan data ke sana; gunakan akun uji.

Tidak perlu membuat project Supabase baru atau mengulang seed/migrasi yang sudah
dijalankan. Panduan ini menyiapkan deployment; aplikasi belum diterbitkan melalui
panduan ini.

## 1. Siapkan kode di GitHub

Pastikan perubahan terbaru sudah di-commit dan di-push ke repository GitHub,
termasuk `package.json`, `package-lock.json`, `src`, dan `public/branding`.
Vercel akan mengambil kode dari GitHub, bukan otomatis dari folder laptop.

File `.env.local` tetap di laptop dan tidak ikut Git. Nilainya dimasukkan melalui
pengaturan Vercel pada langkah berikutnya. Jangan memasukkan service role key ke
repository, tangkapan layar, atau percakapan.

## Jika email Vercel dan akun GitHub berbeda

Email Vercel dan GitHub boleh berbeda. Hubungkan akun GitHub pemilik repository
ke akun Vercel yang digunakan untuk deploy melalui **avatar Vercel → Settings →
Authentication → GitHub / Login Connections → Connect**. Saat otorisasi, pastikan
akun GitHub yang tampil adalah pemilik repository SIPENSI.
[Pengaturan koneksi akun Vercel](https://vercel.com/docs/accounts).

Jika kedua akun milik kamu sendiri, tidak perlu menambahkan collaborator hanya
untuk menghubungkan repository tersebut.

Untuk mengundang teman mengerjakan kode:

1. Masuk GitHub memakai akun pemilik repository.
2. Buka repository → **Settings → Collaborators → Add people**.
3. Pilih username GitHub teman dan kirim undangan.
4. Teman harus membuka undangan melalui akun GitHub yang diundang dan menerima
   undangan tersebut.

Collaborator pada repository akun pribadi mendapat akses membaca dan menulis kode.
[Panduan collaborator GitHub](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/inviting-collaborators-to-a-personal-repository).

Untuk import langsung repository milik akun GitHub pribadi ke Vercel, Vercel
mensyaratkan akun pemilik repository. Status collaborator saja tidak mencukupi.
Jika repository milik orang lain, minta pemilik melakukan import melalui akun atau
team Vercel yang ia berwenang gunakan. Akses GitHub dan keanggotaan team Vercel
diatur secara terpisah. Repository organisasi memiliki aturan akses tersendiri.
[Persyaratan akses GitHub di Vercel](https://vercel.com/docs/git/vercel-for-github#missing-git-repository).

## 2. Import repository ke Vercel

1. Buka [Vercel New Project](https://vercel.com/new), lalu masuk menggunakan akun GitHub.
2. Pilih repository SIPENSI dan klik **Import**. Bila repository belum terlihat,
   atur akses integrasi GitHub untuk repository yang dimaksud.
3. Isi nama project, misalnya `sipensi-uji-hp` jika tersedia.
4. Pilih konfigurasi berikut:

| Pengaturan | Nilai untuk proyek ini |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | Folder yang memuat `package.json`; untuk repository ini `./` |
| Install Command | `npm ci` |
| Build Command | `npm run build -- --webpack` |
| Output Directory | Biarkan bawaan Next.js |
| Node.js Version | 24.x |

Build dengan webpack sudah berhasil pada pemeriksaan lokal proyek. Jangan memakai
`npm run dev` sebagai Build Command. Jika pilihan Node belum ada di halaman import,
atur melalui **Project → Settings → Build and Deployment → Node.js Version**, lalu
deploy ulang jika deployment awal sudah berlangsung.

Vercel mendukung import repository dan pengaturan build di dashboard.
[Panduan import Git](https://vercel.com/docs/git),
[pengaturan build](https://vercel.com/docs/builds/configure-a-build), dan
[versi Node.js](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## 3. Masukkan Environment Variables sebelum Deploy

Salin nilai dari `.env.local` milik proyek ke bagian **Environment Variables**
di Vercel. Buat variabel dengan nama persis berikut, tanpa menambahkan tanda kutip
pada nilainya:

| Nama | Nilai | Kebutuhan |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase yang sudah dipakai | Wajib |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon/public key yang sudah dipakai aplikasi | Wajib |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key yang sudah dipakai server | Wajib untuk fitur server, termasuk PDF dan verifikasi surat |
| `OPENAI_API_KEY` | API key chatbot, jika ingin mengaktifkan pemilihan jawaban dengan AI | Opsional |
| `OPENAI_CHAT_MODEL` | Nilai dari konfigurasi lokal, jika diisi | Opsional |

Pilih cakupan **Production**. Jika juga akan memakai deployment dari branch uji,
tambahkan tiga variabel Supabase tersebut ke **Preview**.

Nama `SUPABASE_SERVICE_ROLE_KEY` harus tetap seperti di tabel. Jangan menambahkan
awalan `NEXT_PUBLIC_` pada server key atau API key chatbot. Keduanya hanya untuk server.
Tanpa `OPENAI_API_KEY`, chatbot tetap dapat memakai panduan SIPENSI bawaan.

Untuk deployment pertama, **jangan menambahkan `NEXT_PUBLIC_APP_URL` yang berisi
localhost**. Variabel itu boleh belum diisi; kode akan memakai alamat request.
Alamat tetapnya diatur setelah domain Vercel tersedia.

Pengaturan environment di Vercel dibedakan menurut lingkungan deployment.
[Dokumentasi Environment Variables](https://vercel.com/docs/environment-variables).

## 4. Deploy dan tetapkan alamat surat

1. Klik **Deploy** dan tunggu sampai status **Ready**.
2. Buka **Project → Settings → Domains** dan salin domain utama yang diberikan
   Vercel, misalnya `https://sipensi-uji-hp.vercel.app`. Nama ini hanya contoh;
   gunakan domain yang benar-benar terdaftar di project kamu.
3. Buka **Settings → Environment Variables**, lalu tambahkan:

   ```text
   NEXT_PUBLIC_APP_URL=https://DOMAIN-VERCEL-KAMU.vercel.app
   ```

4. Pilih **Production**, simpan, lalu masuk **Deployments → deployment terbaru →
   menu titik tiga → Redeploy**.

`NEXT_PUBLIC_APP_URL` harus berisi URL HTTPS aplikasi, bukan URL Supabase atau
`http://localhost:3000`. Pengaturan ini dipakai untuk alamat verifikasi pada QR
surat. Setelah deploy ulang, unduh kembali PDF untuk menguji QR dengan domain baru.

Mengubah environment variable memerlukan deployment baru agar perubahan diterapkan.
[Panduan environment dan redeploy](https://vercel.com/kb/guide/how-to-add-vercel-environment-variables).

Gunakan domain utama dari **Domains** untuk pengujian HP. Link deployment atau
Preview tertentu dapat meminta login Vercel karena Deployment Protection;
itu berbeda dengan halaman login SIPENSI. Pertahankan pengamanan yang sudah
ditetapkan pada akun/project.
[Deployment Protection](https://vercel.com/docs/deployment-protection).

## 5. Periksa alamat di Supabase

Buka project Supabase yang sama, lalu **Authentication → URL Configuration**.

- Jika Vercel ini menjadi alamat utama pertama aplikasi, isi **Site URL** dengan
  domain utama Vercel tadi.
- Jika sudah ada alamat website utama yang masih dipakai, pertahankan Site URL
  tersebut dan tambahkan alamat uji pada Redirect URLs.
- Pada **Redirect URLs**, izinkan domain uji dan tetap simpan akses pengembangan lokal:

  ```text
  https://DOMAIN-VERCEL-KAMU.vercel.app/**
  http://localhost:3000/**
  ```

Login SIPENSI saat ini memakai email dan password; tidak ada langkah callback Google
yang perlu dibuat untuk panduan ini. Pengaturan Site URL terutama menentukan alamat
default pada alur email autentikasi, seperti konfirmasi dan reset password.
[Dokumentasi Redirect URLs Supabase](https://supabase.com/docs/guides/auth/redirect-urls).

## 6. Uji langsung dari HP

1. Buka domain HTTPS utama Vercel menggunakan Chrome Android atau Safari iPhone.
   HP boleh menggunakan Wi-Fi berbeda atau data seluler.
2. Periksa landing page dan chatbot sebelum login.
3. Login dengan akun siswa uji yang sudah tersedia di Supabase.
4. Periksa Beranda, Ajukan Dispen, Riwayat Pengajuan, Surat Izin Digital, dan Notifikasi.
   Coba juga posisi layar tegak dan mendatar.
5. Buat satu pengajuan uji dengan bukti kecil, misalnya gambar **di bawah 500 KB**.
6. Gunakan akun guru uji untuk memprosesnya, lalu periksa perubahan status siswa.
7. Setelah disetujui, periksa pratinjau surat, unduh PDF, dan buka tautan QR dari HP.
8. Pada akun guru, buka **Scan QR Surat**, nyalakan kamera, dan berikan izin kamera
   saat diminta. Bila perlu, pakai unggah gambar QR sebagai alternatif.

Untuk tes kamera, buka melalui browser langsung. Browser di dalam aplikasi pesan
dapat berperilaku berbeda. Laptop tidak perlu terus menjalankan `npm run dev`
agar deployment Vercel dapat dipakai dari HP.

## Batas unggahan pada kode sekarang

Form menampilkan maksimal 5 MB, tetapi pengajuan sekarang mengirim bukti melalui
Server Action. `next.config.ts` belum menaikkan batas bawaan request Server Action
sebesar 1 MB, termasuk isi form dan overhead unggahan. Karena itu, gunakan berkas
kecil dahulu untuk pengujian awal.

Vercel Functions juga memiliki batas payload 4,5 MB. Menaikkan batas Next.js saja
tidak cukup untuk mendukung file 5 MB melalui jalur server yang sama. Dukungan
5 MB penuh memerlukan penyesuaian alur, misalnya unggah langsung ke Supabase
Storage dengan pemeriksaan pemilik dan validasi yang sesuai.
[Batas Vercel Functions](https://vercel.com/docs/functions/limitations) dan
[pengaturan Server Actions Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions).

## Jika ada kendala

| Gejala | Yang diperiksa |
| --- | --- |
| Build gagal karena environment Supabase | Nama dan nilai dua variabel `NEXT_PUBLIC_SUPABASE_*`, serta cakupan Production |
| Build gagal | Buka Build Logs; pastikan Node 24.x, root folder benar, dan Build Command memakai webpack di atas |
| PDF gagal dibuat | Server key tersedia, `NEXT_PUBLIC_APP_URL` memakai domain HTTPS yang benar, kemudian Redeploy |
| QR membuka localhost | Perbarui `NEXT_PUBLIC_APP_URL`, Redeploy, lalu unduh ulang surat |
| Muncul halaman login Vercel | Periksa apakah yang dibuka link deployment/Preview yang dilindungi; gunakan domain utama sesuai kebijakan akses project |
| Pengajuan gagal saat melampirkan file | Uji ulang dengan gambar kecil di bawah 500 KB; lihat batas unggahan di atas |
| Data berbeda dari laptop | Pastikan variabel menunjuk project Supabase yang sama dan kode terbaru sudah di-push/deploy |
| Kamera tidak menyala | Gunakan HTTPS, buka Chrome/Safari langsung, lalu periksa izin kamera |

Jika meminta bantuan lewat chat, cukup kirim pesan error atau bagian Build Logs
yang relevan tanpa menampilkan nilai environment/key.
