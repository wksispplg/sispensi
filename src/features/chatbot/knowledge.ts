import {
  DISPEN_MAX_MINUTES,
  DISPEN_MIN_MINUTES,
  EVIDENCE_MAX_BYTES,
  IZIN_TYPE_LABELS,
  LOGIN_PATH,
  ROLE_LABELS,
} from "@/lib/constants";
import type { ChatLink } from "./contract";

type KnowledgeEntry = {
  id: string;
  title: string;
  answer: string;
  match: RegExp;
  links?: ChatLink[];
};

// Jawaban publik saja. Jangan menambahkan data siswa, kredensial, atau dokumen privat.
export const KNOWLEDGE = [
  {
    id: "tentang",
    title: "Pengertian, manfaat, dan fungsi SIPENSI",
    answer: "SIPENSI (SisPensi) adalah website Sistem Perizinan Siswa Digital untuk SMK Telkom Purwokerto. Siswa dapat mengajukan izin secara online, guru memprosesnya, dan surat izin yang disetujui diterbitkan sebagai PDF dengan QR Code. Pengajuan tercatat rapi dan mengurangi penggunaan kertas.",
    match: /\b(apa itu|apa sih|pengertian|tentang|manfaat|fungsi|kegunaan|tujuan|fitur|kelebihan|sipensi itu|sispensi itu)\b/,
  },
  {
    id: "password",
    title: "Lupa password, akun belum tersedia, pendaftaran, dan masalah login",
    answer: "Akun SIPENSI dikelola oleh sekolah, jadi kamu tidak perlu mendaftar sendiri. Jika belum memiliki akun, lupa password, atau tetap gagal masuk setelah memeriksa email dan password, hubungi Administrator SIPENSI (bagian Tata Usaha). Chatbot tidak dapat membuat akun atau mereset password.",
    match: /\b(lupa|reset|ganti|ubah)\b.{0,30}\b(password|sandi)\b|\b(daftar|registrasi|register|belum.*akun|buat akun|bikin akun|gagal.*(login|masuk)|tidak bisa.*(login|masuk)|ga bisa.*(login|masuk)|gak bisa.*(login|masuk))\b/,
    links: [{ label: "Halaman login", href: LOGIN_PATH }],
  },
  {
    id: "login",
    title: "Cara masuk atau login menggunakan akun sekolah",
    answer: "Klik Masuk di beranda, lalu isi email dan password akun SIPENSI yang diberikan sekolah. Kamu juga bisa memilih Masuk Sebagai Siswa atau Masuk Sebagai Guru di beranda. Setelah berhasil login, menu akan menyesuaikan peran akunmu.",
    match: /\b(login|log in|masuk|sign in)\b/,
    links: [{ label: "Masuk ke SIPENSI", href: LOGIN_PATH }],
  },
  {
    id: "bukti",
    title: "Bukti pendukung: wajib, jenis file, ukuran, dan unggah",
    answer: `Bukti pendukung wajib dilampirkan saat mengajukan izin. Gunakan gambar JPG, PNG, WebP, atau dokumen PDF dengan ukuran maksimal ${EVIDENCE_MAX_BYTES / 1024 / 1024} MB. Lampirkan foto atau dokumen yang mendukung alasan izinmu. Jika unggahan gagal, periksa format, ukuran file, dan koneksi internet, lalu coba lagi.`,
    match: /\b(bukti|lampiran|lampirkan|file|berkas|upload|unggah|jpg|png|webp|pdf|mb)\b/,
  },
  {
    id: "jenis",
    title: "Pilihan jenis izin yang tersedia",
    answer: `Jenis izin yang tersedia di SIPENSI adalah: ${Object.values(IZIN_TYPE_LABELS).join(", ")}. Pilih jenis yang paling sesuai dengan keperluanmu saat mengisi formulir Ajukan Izin.`,
    match: /\b(jenis|macam|kategori|pilihan)\b.{0,25}\b(izin|dispen)\b|\b(izin|dispen)\b.{0,25}\b(apa saja|apa aja|jenis)\b/,
  },
  {
    id: "durasi",
    title: "Durasi, timer, mulai dispen, dan kembali ke sekolah",
    answer: `Izin Keluar Sementara dan Dispensasi Kegiatan memerlukan perkiraan durasi (${DISPEN_MIN_MINUTES}–${DISPEN_MAX_MINUTES} menit). Setelah disetujui, tekan Mulai Dispen pada detail pengajuan saat akan keluar. Hitung mundur dimulai setelah tombol itu ditekan. Saat sudah kembali, tekan Kembali ke Sekolah. Jika durasi terlewati sebelum melapor kembali, sistem menandai keterlambatan.`,
    match: /\b(durasi|timer|countdown|hitung mundur|berapa menit|mulai dispen|kembali ke sekolah|terlambat|batas waktu dispen)\b/,
  },
  {
    id: "pengajuan",
    title: "Cara mengisi formulir dan mengajukan izin",
    answer: "Login sebagai siswa, buka menu Ajukan Izin, lalu pilih jenis izin, isi waktu izin dan alasan, serta lampirkan bukti pendukung. Waktu izin boleh dikosongkan jika mulai sekarang. Untuk Keluar Sementara atau Dispensasi Kegiatan, pilih juga perkiraan durasi. Periksa isian, lalu tekan Kirim Pengajuan. Perkembangannya dapat dilihat di Riwayat Pengajuan.",
    match: /\b(ajukan|mengajukan|pengajuan|mengisi|formulir|form|minta izin|bikin izin|buat izin|cara.*dispen)\b/,
    links: [{ label: "Login untuk mengajukan izin", href: LOGIN_PATH }],
  },
  {
    id: "persetujuan",
    title: "Guru pemroses, persetujuan, penolakan, eskalasi, dan waktu tunggu",
    answer: "Pengajuan diproses oleh guru penanggung jawab berdasarkan jadwal pelajaran. Jika tidak ada jadwal yang sesuai, pengajuan diarahkan ke wali kelas. Pengajuan yang belum ditanggapi dapat diteruskan ke wali kelas lalu Guru BK sesuai pengaturan sekolah. Guru dapat menyetujui atau menolak dengan alasan. Mengirim pengajuan belum berarti izin otomatis disetujui; pantau status di Riwayat Pengajuan.",
    match: /\b(setuju|disetujui|persetujuan|approve|approval|ditolak|penolakan|memproses|diproses|penanggung jawab|wali kelas|eskalasi|menunggu|berapa lama)\b/,
  },
  {
    id: "batal",
    title: "Membatalkan izin dan pengajuan ganda",
    answer: "Pengajuan yang masih menunggu persetujuan dapat dibatalkan melalui detail pengajuan di Riwayat Pengajuan. Untuk jenis izin yang sama, selesaikan atau batalkan pengajuan yang masih menunggu sebelum membuat pengajuan baru. Jika izin sudah diproses dan perlu dikoreksi, hubungi guru penanggung jawab.",
    match: /\b(batal|batalkan|membatalkan|cancel|dobel|ganda|duplikat|koreksi|edit.*izin|ubah.*pengajuan)\b/,
  },
  {
    id: "riwayat",
    title: "Melihat status dan riwayat pengajuan pribadi",
    answer: "Setelah login sebagai siswa, buka Riwayat Pengajuan dan pilih pengajuan untuk melihat status, detail, serta riwayat prosesnya. Chatbot di beranda hanya memberikan panduan umum dan tidak dapat membaca status izin atau data pribadi siswa. Jangan mengirim password atau data pribadi ke chat ini.",
    match: /\b(status|riwayat|history|izin saya|izin aku|data (saya|aku|siswa)|nis|nisn)\b/,
    links: [{ label: "Masuk untuk melihat riwayat", href: LOGIN_PATH }],
  },
  {
    id: "surat",
    title: "Surat izin PDF, unduh, QR Code, dan verifikasi keaslian",
    answer: "Setelah pengajuan disetujui, surat izin PDF dengan QR Code tersedia melalui detail pengajuan. Buka Riwayat Pengajuan setelah login untuk mengakses suratmu. Petugas dapat memindai QR Code pada surat untuk membuka halaman verifikasi keaslian. Chatbot tidak dapat menerbitkan, menyetujui, atau mengambil surat milik siswa.",
    match: /\b(surat|qr|qrcode|verifikasi|unduh|download|cetak)\b/,
  },
  {
    id: "peran",
    title: "Peran pengguna, menu guru, dan administrasi sekolah",
    answer: `SIPENSI memiliki peran ${Object.values(ROLE_LABELS).join(", ")}. Siswa mengajukan dan memantau izin. Guru memproses izin sesuai kewenangannya. Guru BK dan Administrator dapat mengakses rekap sesuai hak akses. Administrator mengelola data master seperti siswa, guru, kelas, mata pelajaran, dan jadwal. Menu mengikuti peran akun yang diberikan sekolah.`,
    match: /\b(peran|role|pengguna|siapa.*(pakai|menggunakan)|admin|administrator|guru|data master|rekap|ekspor|excel)\b/,
  },
  {
    id: "notifikasi",
    title: "Pemberitahuan dan notifikasi aplikasi",
    answer: "SIPENSI menyediakan notifikasi di dalam aplikasi untuk membantu pengguna mengikuti proses izin. Setelah login, periksa ikon lonceng dan status di Riwayat Pengajuan. Suara notifikasi bergantung pada izin dan interaksi di browser; jika tidak terdengar, tetap periksa pemberitahuan di aplikasi.",
    match: /\b(notifikasi|notif|pemberitahuan|lonceng|suara)\b/,
  },
  {
    id: "kontak",
    title: "Tautan website, Instagram, Facebook, dan kontak sekolah di footer",
    answer: "Tautan resmi sekolah tersedia di bagian footer beranda SIPENSI: website SMK Telkom Purwokerto, Instagram @stematelpwt, dan Facebook stematelpwt. Untuk bantuan akun atau kebijakan perizinan, hubungi Administrator SIPENSI di sekolah.",
    match: /\b(kontak|hubungi|bantuan|sosmed|media sosial|instagram|facebook|website sekolah|situs sekolah|whatsapp|telepon|nomor.*sekolah)\b/,
    links: [
      { label: "Website sekolah", href: "https://smktelkom-pwt.sch.id/" },
      { label: "Instagram", href: "https://www.instagram.com/stematelpwt/" },
      { label: "Facebook", href: "https://www.facebook.com/stematelpwt" },
    ],
  },
] as const satisfies readonly KnowledgeEntry[];

export type ChatTopic = (typeof KNOWLEDGE)[number]["id"];

export function findTopic(id: string | undefined): KnowledgeEntry | undefined {
  return KNOWLEDGE.find((item) => item.id === id);
}

export const UNKNOWN_REPLY =
  "Informasi tersebut belum tersedia dalam panduan SIPENSI. Silakan hubungi Administrator SIPENSI di sekolah agar mendapat penjelasan yang tepat. Kamu juga bisa bertanya tentang login, pengajuan izin, bukti pendukung, atau surat izin.";
