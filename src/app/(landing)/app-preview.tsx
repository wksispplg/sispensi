import {
  ArrowLeft,
  Bell,
  CalendarClock,
  ChevronDown,
  GraduationCap,
  Paperclip,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Cuplikan statis halaman "Ajukan Izin" untuk hero landing. Murni dekoratif
 * (aria-hidden, tidak bisa diklik) — dibuat dengan JSX agar tajam di semua
 * ukuran layar tanpa file gambar.
 */
export function AppPreview() {
  return (
    <div
      aria-hidden
      className="pointer-events-none overflow-hidden rounded-t-2xl bg-white text-left text-zinc-900 shadow-2xl shadow-black/30 select-none"
    >
      {/* Header aplikasi */}
      <div className="flex items-center justify-between border-b px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="bg-brand flex size-6 items-center justify-center rounded-md text-white">
            <GraduationCap className="size-3.5" />
          </div>
          <div className="leading-tight">
            <p className="text-[11px] font-semibold">SIPENSI</p>
            <p className="hidden text-[9px] text-zinc-500 sm:block">
              SMK Telkom Purwokerto
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="relative">
            <Bell className="size-3.5 text-zinc-500" />
            <span className="bg-brand absolute -top-0.5 -right-0.5 size-1.5 rounded-full" />
          </span>
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-[10px] font-medium">Siswa Contoh</p>
            <p className="text-[9px] text-zinc-500">Siswa</p>
          </div>
          <span className="rounded-md border px-2 py-0.5 text-[10px]">
            Keluar
          </span>
        </div>
      </div>

      {/* Isi halaman */}
      <div className="bg-zinc-50/60 px-4 pt-4 pb-10 sm:px-6">
        <div className="mx-auto max-w-md">
          <p className="mb-2 inline-flex items-center gap-1 text-[10px] text-zinc-500">
            <ArrowLeft className="size-3" /> Kembali ke riwayat
          </p>
          <div className="rounded-xl border bg-white p-4 shadow-xs">
            <p className="text-sm font-semibold">Ajukan Izin</p>
            <p className="mt-0.5 text-[10px] text-zinc-500">
              Isi detail izin Anda. Setelah dikirim, pengajuan akan diproses
              sesuai alur persetujuan.
            </p>

            <div className="mt-3 flex flex-col gap-2.5">
              <FakeField label="Jenis izin">
                <span className="text-zinc-500">Dispensasi</span>
                <ChevronDown className="size-3 text-zinc-400" />
              </FakeField>
              <FakeField label="Waktu izin">
                <span>12/10/2026 08.15</span>
                <CalendarClock className="size-3 text-zinc-400" />
              </FakeField>
              <p className="rounded-md bg-emerald-50 px-2 py-1.5 text-[9px] text-emerald-700">
                Jam ke-2 · Pemrograman Web — pengajuan diteruskan ke guru
                pengampu.
              </p>
              <FakeField label="Alasan" tall>
                <span className="text-zinc-500">
                  Mewakili sekolah dalam lomba LKS tingkat kabupaten.
                </span>
              </FakeField>
              <FakeField label="Bukti pendukung">
                <span className="inline-flex items-center gap-1">
                  <Paperclip className="size-3 text-zinc-400" />
                  surat-tugas-lomba.pdf
                </span>
              </FakeField>
              <span className="bg-brand mt-1 w-fit rounded-md px-3 py-1.5 text-[10px] font-medium text-white">
                Kirim Pengajuan
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FakeField({
  label,
  tall,
  children,
}: {
  label: string;
  tall?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium">{label}</span>
      <span
        className={cn(
          "flex justify-between gap-2 rounded-md border px-2 text-[10px]",
          tall ? "h-10 items-start py-1.5" : "h-7 items-center",
        )}
      >
        {children}
      </span>
    </div>
  );
}
