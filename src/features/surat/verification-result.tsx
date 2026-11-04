import { BadgeCheck, Clock3, ShieldX } from "lucide-react";
import { lessonRangeLabel } from "@/features/izin/lesson-periods";

import { IZIN_TYPE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { verificationState, type LetterVerification } from "./verification";

const dateFmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" });
const dateTime = (date: string) => `${dateFmt.format(new Date(date))} WIB`;

export function VerificationResult({ info, checkedAt }: { info: LetterVerification; checkedAt: string }) {
  const state = verificationState(info, new Date(checkedAt).getTime());
  const Icon = state.tone === "danger" ? ShieldX : state.tone === "warning" ? Clock3 : BadgeCheck;
  return (
    <div className="space-y-5">
      <div role="status" className={cn("rounded-2xl border p-4", {
        "border-emerald-200 bg-emerald-50 text-emerald-900": state.tone === "success",
        "border-amber-200 bg-amber-50 text-amber-900": state.tone === "warning",
        "border-red-200 bg-red-50 text-red-900": state.tone === "danger",
      })}>
        <div className="flex items-start gap-3"><Icon className="mt-0.5 size-6 shrink-0" aria-hidden /><div><h3 className="font-semibold">{state.title}</h3><p className="mt-1 text-sm leading-relaxed">{state.description}</p></div></div>
      </div>
      <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm wrap-anywhere sm:grid-cols-[8rem_minmax(0,1fr)]">
        <dt className="text-muted-foreground">Nomor surat</dt><dd>{info.letterNumber ?? "Belum diberi nomor"}</dd>
        <dt className="text-muted-foreground">Nama siswa</dt><dd className="font-semibold">{info.studentName}</dd>
        <dt className="text-muted-foreground">Kelas</dt><dd>{info.className}</dd>
        <dt className="text-muted-foreground">Jenis izin</dt><dd>{IZIN_TYPE_LABELS[info.izinType]}</dd>
        <dt className="text-muted-foreground">Waktu izin</dt><dd>{dateTime(info.requestedAt)}</dd>
        {info.requestedUntil && <><dt className="text-muted-foreground">Sampai</dt><dd>{dateTime(info.requestedUntil)}</dd></>}
        {info.lessonPeriodStart && info.lessonPeriodEnd && <><dt className="text-muted-foreground">Jam pelajaran</dt><dd>{lessonRangeLabel(info.lessonPeriodStart, info.lessonPeriodEnd)}</dd></>}
        {info.decidedAt && <><dt className="text-muted-foreground">Disetujui pada</dt><dd>{dateTime(info.decidedAt)}</dd></>}
      </dl>
      <p className="border-t pt-3 text-xs leading-relaxed text-zinc-500">Diperiksa pada {dateTime(checkedAt)}.</p>
    </div>
  );
}
