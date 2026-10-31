# Asisten SIPENSI di beranda

Chatbot muncul melalui tombol **Tanya SIPENSI** di pojok kanan bawah landing
page, sebelum login. Chat tidak ditampilkan di halaman login atau dashboard.
Pertanyaan dibatasi pada penggunaan website SIPENSI.

Balasan untuk pertanyaan di luar topik:

> Mohon ajukan pertanyaan seputar website SIPENSI saja.

## Mengaktifkan AI

Chatbot langsung bisa digunakan tanpa perubahan database. Tanpa API key,
chatbot menjawab pertanyaan umum dari panduan bawaan dan menampilkan label
**Panduan SIPENSI**. Pemahaman kalimat bebas pada mode ini lebih terbatas.

Untuk mengaktifkan pemahaman pertanyaan dengan OpenAI, tambahkan konfigurasi
berikut ke `.env.local` pada laptop, atau ke environment variables di layanan
hosting saat deployment:

```dotenv
OPENAI_API_KEY=isi-kunci-api-openai-di-sini
OPENAI_CHAT_MODEL=gpt-4o-mini
```

Gunakan kunci dari project OpenAI yang memiliki akses API dan kuota. Simpan
kunci hanya di server: jangan gunakan prefix `NEXT_PUBLIC_`, jangan masukkan
ke Git, dan jangan kirim melalui chat pengguna. Restart server lokal atau
deploy ulang setelah mengubah environment variables.

AI menggunakan Responses API dengan keluaran terstruktur untuk memilih topik
panduan. Teks jawaban dan tautan tetap diambil dari panduan SIPENSI di server,
bukan dari pengetahuan umum model. Lihat
[dokumentasi Structured Outputs OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs).
Model dapat diganti melalui `OPENAI_CHAT_MODEL` dengan model yang mendukung
Responses API dan Structured Outputs.

Jika layanan AI gagal, kehabisan kuota, atau melewati batas waktu, chatbot
kembali ke panduan bawaan. Label pada balasan membedakan **Dibantu AI** dengan
**Panduan SIPENSI**. Pesan tidak dicatat ke database aplikasi. Saat AI aktif,
pertanyaan dikirim ke OpenAI untuk menentukan topik, dengan `store: false`.
Pengguna diingatkan agar tidak mengirim data pribadi.

## Isi panduan

Panduan meliputi pengertian SIPENSI, akun/login, lupa password, cara mengajukan
izin, bukti pendukung, jenis izin, durasi dispen, persetujuan, pembatalan,
riwayat, surat PDF/QR, peran pengguna, notifikasi, dan kontak sekolah.

- Ubah isi jawaban dan tautan di `src/features/chatbot/knowledge.ts` ketika fitur berubah.
- Atur pesan penolakan, sapaan, dan pertanyaan awal di `src/features/chatbot/contract.ts`.
- Atur pemilihan topik dan pemeriksaan pesan di `src/features/chatbot/service.ts`.
- Tampilan panel ada di `src/features/chatbot/chat-widget.tsx`.
- Endpoint publik hanya `POST /api/chat`; rute lain tetap memakai proteksi login.

Chatbot memberikan panduan umum. Chatbot tidak membaca data siswa, mengecek
status izin pribadi, membuat akun, mereset password, atau menyetujui izin.
Jawaban atas kebijakan yang belum dicantumkan diarahkan ke administrator.

## Saat deployment

1. Masukkan environment variables Supabase seperti setup aplikasi biasa.
   Gunakan database yang sudah disediakan pemilik proyek.
2. Tambahkan `OPENAI_API_KEY` di server hosting jika ingin mengaktifkan AI.
3. Isi `NEXT_PUBLIC_APP_URL` dengan URL aplikasi yang digunakan pengguna.
4. Build dan deploy ulang. Buka landing page tanpa login dan uji tombol chat.
5. Uji pertanyaan “Bagaimana cara mengajukan izin?” lalu “Bagaimana cuaca hari ini?”.
   Pertanyaan kedua harus menghasilkan pesan penolakan di atas.

Endpoint membatasi ukuran pesan, menolak permintaan browser dari situs lain,
dan membatasi request menjadi 12 per menit per IP serta 120 per menit per
proses. Batas ini disimpan di memori, sehingga tidak dibagi antar-instance
dan direset saat proses hosting restart. Untuk trafik publik yang besar,
pasang rate limit terpusat di gateway/hosting dan atur batas penggunaan di
project penyedia AI. Pastikan hosting menimpa header `x-forwarded-for` dengan
IP pengunjung yang tepercaya.

## Pemeriksaan pengembangan

```powershell
node --test tests/chatbot.test.mjs
npm run lint
npx tsc --noEmit
npm run build -- --webpack
```

Tes chatbot tidak memanggil API berbayar dan tidak membutuhkan akun Supabase.
Tes meliputi panduan, penolakan topik/campuran/instruksi pengalih, validasi
keluaran AI, kegagalan provider, validasi endpoint, dan pembatasan request.
