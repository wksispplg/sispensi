# Izin Masuk Kelas

Siswa membuka menu **Izin Masuk Kelas**, mengisi alasan dan detail opsional,
memilih satu jam mapel (1–11), lalu melampirkan bukti. Pengajuan berlaku untuk
hari ini dalam WIB. Jam istirahat tidak menjadi pilihan.

Guru penanggung jawab mengikuti jadwal kelas pada jam yang dipilih. Jika jadwal
tidak tersedia, pengajuan diarahkan ke wali kelas. Persetujuan, riwayat,
notifikasi, surat PDF, dan verifikasi QR memakai alur yang sama dengan izin lain.
Form Ajukan Dispen tetap memakai pilihan jam awal dan jam akhir.

## Aktivasi pada Supabase yang sudah dipakai

1. Buka proyek Supabase aplikasi ini, lalu **SQL Editor → New query**.
2. Salin seluruh isi `supabase/migrations/0015_class_entry.sql` ke editor.
3. Klik **Run**. Migrasi ini memerlukan migrasi 0001–0014 yang sudah terpasang.
4. Jalankan versi aplikasi terbaru atau deploy ulang ke Vercel.
5. Di akun admin, lengkapi wali kelas dan jadwal guru untuk kelas siswa.

Migrasi menambahkan jenis izin `masuk_kelas` dan membatasi pengajuan ini
menjadi satu jam mapel. Data pengajuan lama dipertahankan. Migrasi aman diulang.
Tanpa migrasi, pengajuan masuk kelas menampilkan pesan aktivasi database dan
tidak mengunggah bukti. Akun dan form dispensasi yang sudah ada tetap berjalan.

## Pemeriksaan

- Login sebagai siswa dan buka **Izin Masuk Kelas**.
- Pastikan hanya ada satu pilihan jam mapel, dengan alasan dan bukti wajib.
- Pilih jam yang sudah memiliki guru atau wali kelas, lalu kirim pengajuan.
- Periksa pengajuan pada akun guru yang sesuai; jenisnya **Izin Masuk Kelas**.
- Setelah disetujui, periksa nama siswa, satu jam mapel, dan QR pada surat PDF.
