# Tutorial Setup SIPENSI di Laptop Teman

Panduan ini ditujukan untuk Windows dengan terminal PowerShell. Ada catatan
macOS/Linux pada langkah penyalinan konfigurasi.

Teman menggunakan **project Supabase yang sudah disiapkan pemilik proyek**.
Tidak perlu membuat database/project Supabase baru, menjalankan migrasi SQL,
atau mengisi seed data.

Disusun pada 31 Oktober 2026 berdasarkan kode proyek: Next.js 16.3.5, React
19.2.8, npm, dan Supabase. Semua perintah dijalankan di folder proyek yang
memuat `package.json`, kecuali perintah `git clone`.

## 1. Siapkan akses dari pemilik proyek

Sebelum mulai, minta pemilik proyek menyiapkan:

- Akses ke repository `https://github.com/wksispplg/sispensi.git`. Jika private,
  pastikan akun GitHub teman sudah diberi akses dan undangannya sudah diterima.
- Konfigurasi Supabase yang sudah disiapkan: Project URL, public key, dan server
  key, atau file `.env.local` yang diberikan secara privat.
- Akun uji untuk login, minimal akun siswa. Minta akun guru/admin jika akan
  mengerjakan atau menguji fitur peran tersebut.

Git menyinkronkan kode. Konfigurasi `.env.local` tidak ikut terunduh saat clone.
Setelah konfigurasi diisi, aplikasi di laptop teman terhubung ke akun, database,
dan Storage Supabase yang sama dengan milik pemilik proyek.

Perubahan data dari laptop teman juga terlihat di laptop anggota lain yang
terhubung ke project Supabase tersebut. Gunakan akun dan data uji yang sudah
disepakati untuk mencoba fitur.

## 2. Install aplikasi yang diperlukan

1. Install **Node.js 24.x**, untuk menyamakan versi utama dengan lingkungan
   pengembangan proyek. npm tersedia bersama instalasi Node.js. Pilih versi
   24.x pada [halaman unduhan resmi Node.js](https://nodejs.org/en/download).
2. Install [Git for Windows](https://git-scm.com/install/windows).
3. Gunakan editor kode, misalnya [Visual Studio Code](https://code.visualstudio.com/download).

Tutup dan buka kembali terminal setelah instalasi. Periksa:

```powershell
node --version
npm --version
git --version
```

Ketiganya harus menampilkan nomor versi. `node --version` sebaiknya dimulai
dengan `v24.`. Proyek ini terakhir diperiksa pada laptop pemilik dengan Node.js
24.13.0; nomor patch pada laptop teman boleh berbeda dalam versi 24.x.

Database sudah tersedia di Supabase milik pemilik proyek.
Tidak perlu menyiapkan XAMPP, MySQL, PostgreSQL lokal, atau Docker.

## 3. Ambil kode proyek dan install dependency

Buka terminal di folder tempat proyek ingin disimpan, lalu jalankan:

```powershell
git clone https://github.com/wksispplg/sispensi.git
cd sispensi
npm ci
```

Perintah clone di atas membuat folder bernama `sispensi`. Nama folder ini boleh
berbeda dari nama folder di laptop pemilik.

`npm ci` menggunakan versi dependency dari `package-lock.json`. Jika isinya
tidak sesuai dengan `package.json`, npm akan memberi error; sinkronkan kedua
file tersebut dengan pemilik proyek. Lihat [dokumentasi npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/).

Buka folder `sispensi` di VS Code melalui **File → Open Folder**.

Jika menerima proyek dalam bentuk ZIP, ekstrak terlebih dahulu, buka folder
yang memuat `package.json`, lalu jalankan `npm ci`. Gunakan clone Git untuk
kolaborasi melalui branch dan pull request.

## 4. Buat konfigurasi `.env.local`

Jika pemilik sudah memberikan file `.env.local`, letakkan file tersebut di
folder yang sama dengan `package.json`, lalu lanjut ke langkah 5. Jika pemilik
memberikan URL dan key secara terpisah, buat file dari template berikut.

Di folder yang sama dengan `package.json`, jalankan:

```powershell
Copy-Item .env.example .env.local
```

Untuk macOS/Linux, gunakan:

```bash
cp .env.example .env.local
```

Perintah ini untuk setup pertama. Jika `.env.local` sudah berisi konfigurasi,
edit file yang ada agar nilainya tidak tertimpa.

Buka `.env.local` di editor dan isi nilai Supabase yang diberikan pemilik:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ISI_PUBLIC_KEY_DARI_PEMILIK
SUPABASE_SERVICE_ROLE_KEY=ISI_SERVER_KEY_DARI_PEMILIK
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Ganti tiga nilai contoh pertama dengan konfigurasi sebenarnya. URL dan kedua
key harus berasal dari **project Supabase yang sama**.

| Variabel dalam proyek ini | Nilai yang digunakan |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public key yang digunakan proyek, dari pemilik |
| `SUPABASE_SERVICE_ROLE_KEY` | Server key yang digunakan proyek, dari pemilik |
| `NEXT_PUBLIC_APP_URL` | Opsional; alamat aplikasi untuk tautan verifikasi QR pada surat PDF |

Nama variabel harus tetap mengikuti tabel di atas karena itulah nama yang
dibaca oleh kode proyek. URL saja belum melengkapi konfigurasi: public key,
server key, serta akun uji juga disediakan pemilik.

Simpan `.env.local` di laptop sendiri dan terima konfigurasi melalui saluran
privat. Server key hanya untuk sisi server; jangan masukkan nilainya ke variabel
`NEXT_PUBLIC_*` atau commit Git. Lihat [panduan API key Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

Pastikan nama file tepat `.env.local`, bukan `.env.local.txt`. Setelah mengubah
file ini, hentikan server dengan `Ctrl+C`, lalu jalankan kembali.

`NEXT_PUBLIC_APP_URL=http://localhost:3000` cocok untuk pengujian pada laptop
itu sendiri. Pengujian QR dari HP memerlukan alamat aplikasi yang juga dapat
diakses oleh HP.

## 5. Jalankan web di laptop

```powershell
npm run dev
```

Biarkan terminal ini tetap berjalan. Buka alamat yang ditampilkan terminal,
biasanya:

- Halaman awal: `http://localhost:3000`
- Login: `http://localhost:3000/login`

Masuk menggunakan akun uji dari pemilik proyek. Akun GitHub dan akun Supabase
Dashboard berbeda dari akun login pengguna SIPENSI.

Jika muncul error internal **Turbopack**, hentikan proses dengan `Ctrl+C`, lalu:

```powershell
npm run dev -- --webpack
```

Jalur Webpack pernah berhasil digunakan untuk memeriksa proyek ini. Perintah
tersebut tidak mengubah dependency atau script dalam `package.json`.

Jika port 3000 sedang digunakan, pilih port lain:

```powershell
npm run dev -- --port 3001
```

Buka `http://localhost:3001`. Jika `NEXT_PUBLIC_APP_URL` diisi, sesuaikan nilainya
menjadi `http://localhost:3001` agar alamat QR konsisten. Opsi port juga bisa
digabungkan: `npm run dev -- --webpack --port 3001`.

## 6. Periksa bahwa setup berhasil

Lakukan pemeriksaan awal berikut menggunakan data uji:

1. Halaman awal dan halaman login terbuka.
2. Akun siswa dapat login dan melihat Home serta menu Ajukan Izin/Riwayat.
3. Form pengajuan menampilkan jenis izin dan informasi penanggung jawab.
4. Jika akan menguji alur lengkap, koordinasikan dengan pemilik database:
   buat pengajuan uji dengan bukti, proses lewat akun guru yang ditugaskan,
   lalu periksa status, notifikasi, surat PDF, dan halaman verifikasi QR.

Untuk memeriksa kode, buka terminal kedua di folder proyek:

```powershell
npm run lint
npx tsc --noEmit
```

Pemeriksaan build produksi bersifat tambahan untuk setup awal:

```powershell
npm run build
npm start
```

Jalankan `npm start` setelah build berhasil dan pastikan port yang digunakan
tidak sedang dipakai server development. Jika Turbopack bermasalah, build lewat:

```powershell
npm run build -- --webpack
npm start
```

Build membutuhkan koneksi ke Google Fonts untuk mengambil Poppins dan Geist
Mono yang digunakan di `src/app/layout.tsx`.

## 7. Cara bekerja bersama lewat Git

Sebelum mulai fitur baru, pastikan pekerjaan lokal sebelumnya sudah disimpan
dalam commit atau diamankan. Ambil kode utama dan buat branch sendiri:

```powershell
git switch main
git pull --ff-only origin main
git switch -c fitur/nama-fitur
```

Ganti `nama-fitur` dengan pekerjaan yang akan dilakukan, misalnya
`fitur/rapikan-riwayat`. Saat selesai, periksa perubahan dan tambahkan file
yang memang dikerjakan:

```powershell
git status
git diff
```

Contoh jika yang diubah hanya form pengajuan:

```powershell
git add 'src/app/(app)/izin/ajukan/page.tsx'
git commit -m "Rapikan tampilan form pengajuan"
git push -u origin fitur/nama-fitur
```

Gunakan nama branch yang dibuat sebelumnya, lalu buat pull request di GitHub
agar pemilik proyek bisa meninjau perubahan.

Saat mengambil update berikutnya, jalankan `npm ci` lagi jika
`package.json`/`package-lock.json` berubah. Jika ada migrasi SQL baru,
koordinasikan dengan pemilik proyek yang mengelola database bersama.

## 8. Solusi kendala yang sering muncul

| Kendala | Yang diperiksa |
| --- | --- |
| `node`, `npm`, atau `git` tidak dikenali | Pastikan aplikasinya terinstall dan buka ulang terminal setelah instalasi |
| PowerShell memblokir `npm.ps1` | Gunakan `npm.cmd ci` / `npm.cmd run dev`, atau pilih terminal Command Prompt; untuk npx gunakan `npx.cmd` |
| `Repository not found` atau tidak bisa clone | Periksa URL, akun GitHub yang digunakan, serta akses ke repo jika private |
| `npm ci` gagal karena lockfile | Pastikan `package.json` dan `package-lock.json` berasal dari versi repo yang sama; sinkronkan dengan pemilik |
| `Konfigurasi environment Supabase tidak valid` | Periksa `.env.local` di folder `package.json`, isi URL/key, lalu restart server |
| `SUPABASE_SERVICE_ROLE_KEY belum di-set` | Isi server key dari project yang sama; ini dipakai antara lain untuk admin, lookup jadwal, dan surat |
| `Invalid API key` / `Failed to fetch` | Periksa kecocokan URL dan key, koneksi internet, serta status project Supabase |
| Email/password salah | Gunakan akun pengguna SIPENSI yang ada pada project tersebut; cek konfirmasi email dan password bersama admin |
| `Akun belum aktif` | Akun Auth belum memiliki profil yang dapat dibaca; minta admin memeriksa baris `profiles` sesuai ID akun |
| Tabel atau fungsi tidak ditemukan | Periksa kecocokan URL/key dengan konfigurasi pemilik dan laporkan ke pemilik yang mengelola database |
| Penanggung jawab belum tersedia | Periksa kelas siswa, wali kelas, jadwal, dan akun guru pada data master |
| Bukti gagal diunggah | Periksa jenis file dan batas ukuran 5 MB; jika masih gagal, minta pemilik memeriksa Storage |
| Port 3000 sudah dipakai | Baca URL pada terminal atau jalankan dengan `--port 3001` |
| Error internal Turbopack | Coba `npm run dev -- --webpack` atau `npm run build -- --webpack` |
| Gagal mengambil font saat build | Periksa koneksi ke Google Fonts; Poppins dan Geist Mono diunduh saat build |

## Ringkasan setup dengan Supabase yang sudah disiapkan

```powershell
git clone https://github.com/wksispplg/sispensi.git
cd sispensi
npm ci
Copy-Item .env.example .env.local
```

Isi `.env.local` dari konfigurasi yang diberikan pemilik, lalu:

```powershell
npm run dev
```

Buka `http://localhost:3000/login` dan login menggunakan akun uji yang disediakan.
