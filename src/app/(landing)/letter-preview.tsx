import { CircleCheck, GraduationCap, QrCode } from "lucide-react";

const rows: [string, string][] = [
  ["Nama", "Siswa Contoh"],
  ["Kelas", "XI RPL 1"],
  ["Jenis izin", "Dispensasi"],
  ["Waktu", "Senin, 12 Okt 2026 · 08.15"],
];

/**
 * Ilustrasi surat izin digital untuk bagian "Apa itu SisPensi?" — kartu abu
 * miring berisi contoh surat ber-QR. Murni dekoratif.
 */
export function LetterPreview() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-sm select-none md:mr-0">
      <div className="rotate-3 rounded-[2rem] bg-zinc-200/80 p-4 sm:p-8">
        <div className="-rotate-3 rounded-2xl bg-white p-4 shadow-xl shadow-zinc-900/10 sm:p-5">
          <div className="flex items-center gap-2.5 border-b pb-3">
            <div className="bg-brand flex size-8 shrink-0 items-center justify-center rounded-lg text-white">
              <GraduationCap className="size-4.5" />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="text-xs font-semibold tracking-wide">
                SURAT IZIN SISWA
              </p>
              <p className="text-muted-foreground text-[11px]">
                SMK Telkom Purwokerto
              </p>
            </div>
          </div>

          <dl className="mt-3 grid grid-cols-[5rem_minmax(0,1fr)] gap-x-2 gap-y-1.5 text-xs">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium wrap-anywhere">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              <CircleCheck className="size-3.5" /> Disetujui
            </span>
            <div className="flex flex-col items-center gap-1">
              <div className="rounded-lg border p-1.5">
                <QrCode className="size-14 text-zinc-900" strokeWidth={1.5} />
              </div>
              <span className="text-muted-foreground text-[10px]">
                Pindai untuk verifikasi
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
