"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Upload } from "lucide-react";

import { createPermissionRequest, lookupSchedule, type CreateState, type LookupResult } from "./actions";
import { EVIDENCE_MIME_TYPES, IZIN_TYPES, IZIN_TYPE_LABELS, LESSON_PERIODS, REQUEST_TITLE_MAX_LENGTH, REQUEST_REASON_MAX_LENGTH, STORAGE_BUCKETS } from "@/lib/constants";
import { useFormAction } from "@/hooks/use-form-action";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { DEMO_LESSON_PERIOD, DISPENSATION_PERIOD_ENDED, firstAvailableLessonPeriod, lessonPeriodLabel, lessonPeriodsToday, lessonRangeLabel } from "@/features/izin/lesson-periods";
import { createEvidencePath, evidenceError } from "@/features/izin/evidence";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectNative } from "@/components/ui/select-native";

const initialState: CreateState = {};
const fieldClass = "h-11 rounded-lg border-[#a5a7ae] bg-white text-base shadow-none md:h-8 md:text-[11px]";

export default function PermissionRequestForm({ entry = false }: { entry?: boolean }) {
  const router = useRouter();
  const uploadRef = useRef<{ file: File; path: string; uploaded: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [state, formProps, pending] = useFormAction(async (previous, formData) => {
    const start = Number(formData.get("lesson_period_start"));
    if ((!entry || start === DEMO_LESSON_PERIOD.number) && !uploadRef.current?.uploaded && start > 0 && start < firstAvailableLessonPeriod()) {
      return { error: DISPENSATION_PERIOD_ENDED };
    }
    const file = formData.get("evidence");
    if (!(file instanceof File)) return { error: "Bukti pendukung wajib dilampirkan." };
    const validationError = evidenceError(file.size, file.type);
    if (validationError) return { error: validationError };

    let upload = uploadRef.current;
    try {
      const supabase = createClient();
      if (!upload || upload.file !== file) {
        // ID di sini hanya menentukan folder. Storage dan server memverifikasi sesi.
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) return { error: "Sesi tidak valid. Silakan login ulang." };
        upload = { file, path: createEvidencePath(user.id, file.type), uploaded: false };
        uploadRef.current = upload;
      }

      if (!upload.uploaded) {
        const storage = supabase.storage.from(STORAGE_BUCKETS.EVIDENCE);
        const { error } = await storage.upload(upload.path, file, { contentType: file.type, upsert: false });
        if (error) {
          // Periksa apakah unggahan sebelumnya tersimpan meski responsnya terputus.
          const { data } = await storage.info(upload.path);
          if (data?.size !== file.size || data?.contentType !== file.type) {
            return { error: "Bukti belum berhasil diunggah. Periksa koneksi lalu coba kirim lagi." };
          }
        }
        upload.uploaded = true;
      }
    } catch {
      return { error: "Bukti belum berhasil diunggah. Periksa koneksi lalu coba kirim lagi." };
    }

    formData.delete("evidence");
    formData.set("evidence_path", upload.path);
    setSaving(true);
    try {
      const result = await createPermissionRequest(previous, formData);
      if (result.ok) router.push("/izin?ok=1");
      return result;
    } catch {
      return { error: "Status pengajuan belum dapat dipastikan. Periksa koneksi lalu coba kirim lagi." };
    } finally {
      setSaving(false);
    }
  }, initialState);
  const [startPeriod, setStartPeriod] = useState("");
  const [endPeriod, setEndPeriod] = useState("");
  const [periods, setPeriods] = useState<ReturnType<typeof lessonPeriodsToday>>(LESSON_PERIODS);
  const [firstAvailable, setFirstAvailable] = useState(1);
  const [evidence, setEvidence] = useState<{ name: string; size: number } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [preview, setPreview] = useState<LookupResult | null>(null);
  const [previewPending, startPreview] = useTransition();
  const startNumber = Number(startPeriod);
  const startExpired = (!entry || startNumber === DEMO_LESSON_PERIOD.number) && startNumber > 0 && startNumber < firstAvailable;
  const allPeriodsEnded = !entry && firstAvailable > periods[periods.length - 1].number;

  useEffect(() => {
    let timer = window.setTimeout(refresh, 0);
    function refresh() {
      const now = new Date();
      const availablePeriods = lessonPeriodsToday(now);
      setPeriods(availablePeriods);
      const keepAvailable = (value: string) => availablePeriods.some((period) => period.number === Number(value)) ? value : "";
      setStartPeriod(keepAvailable);
      setEndPeriod(keepAvailable);
      setFirstAvailable(firstAvailableLessonPeriod(now));
      timer = window.setTimeout(refresh, 60_000 - now.getTime() % 60_000);
    }
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!startPeriod || startExpired) return;
    let active = true;
    const handle = setTimeout(() => {
      startPreview(async () => {
        const result = await lookupSchedule(startPeriod).catch((): LookupResult => ({ status: "error", message: "Jadwal belum dapat dimuat. Periksa koneksi lalu pilih kembali jam pelajaran." }));
        if (active) setPreview(result);
      });
    }, 150);
    return () => { active = false; clearTimeout(handle); };
  }, [startPeriod, startExpired]);

  const selectedEnd = entry ? startPeriod : endPeriod;
  const canSubmit = !pending && !previewPending && !fileError && !startExpired && !!startPeriod && !!selectedEnd && !!preview && (preview.status === "found" || (preview.status === "fallback" && !!preview.approver));
  const timeLabel = lessonRangeLabel(Number(startPeriod), Number(selectedEnd));

  return <div className="grid min-w-0 items-start gap-5 pt-2 lg:grid-cols-[minmax(0,1.85fr)_minmax(240px,1fr)] lg:pt-3">
    <form {...formProps} aria-busy={pending} className="student-panel flex min-w-0 flex-col gap-3.5 p-5 sm:p-7">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reason" className="text-[11px] font-medium">Alasan</Label>
        <Input id="reason" name="reason" required minLength={5} maxLength={REQUEST_TITLE_MAX_LENGTH} placeholder="Tulis alasan maks. 20 karakter" className={fieldClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reason_detail" className="text-[11px] font-medium">Detail alasan <span className="font-normal">(opsional)</span></Label>
        <Textarea id="reason_detail" name="reason_detail" rows={2} maxLength={REQUEST_REASON_MAX_LENGTH - REQUEST_TITLE_MAX_LENGTH - 1} placeholder="Jelaskan alasan kamu…" className="min-h-14 resize-y rounded-lg border-[#a5a7ae] bg-white text-base shadow-none md:text-[11px]" />
      </div>
      <div className="flex max-w-xs flex-col gap-2">
        <Label htmlFor="izin_type" className="text-[11px] font-medium">Jenis izin</Label>
        {entry ? <>
          <Input id="izin_type" value={IZIN_TYPE_LABELS[IZIN_TYPES.MASUK_KELAS]} readOnly className={fieldClass} />
          <input type="hidden" name="izin_type" value={IZIN_TYPES.MASUK_KELAS} />
        </> : <SelectNative id="izin_type" name="izin_type" required defaultValue="" className={fieldClass}>
          <option value="" disabled>Pilih jenis izin…</option>
          {Object.entries(IZIN_TYPE_LABELS).filter(([value]) => value !== IZIN_TYPES.MASUK_KELAS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectNative>}
      </div>
      <fieldset className="min-w-0">
        <legend className="mb-2 text-[11px] font-medium">Jam mapel</legend>
        <div className={cn("grid min-w-0 gap-3", entry ? "max-w-xs" : "sm:grid-cols-2")}>
          <div className="min-w-0">
            <Label htmlFor="lesson_period_start" className="sr-only">{entry ? "Jam pelajaran masuk kelas" : "Dari jam pelajaran"}</Label>
            <SelectNative id="lesson_period_start" name="lesson_period_start" required value={startPeriod} disabled={allPeriodsEnded} className={fieldClass}
              onChange={(event) => { const value = event.target.value; setStartPeriod(value); if (endPeriod && Number(endPeriod) < Number(value)) setEndPeriod(""); setPreview(null); }}>
              <option value="" disabled>{entry ? "Pilih jam mapel masuk" : "Pilih jam mapel mulai"}</option>
              {periods.map((period) => {
                const ended = (!entry || period.number === DEMO_LESSON_PERIOD.number) && period.number < firstAvailable;
                return <option key={period.number} value={period.number} disabled={ended}>{lessonPeriodLabel(period.number)}{ended ? " · Selesai" : ""}</option>;
              })}
            </SelectNative>
          </div>
          {!entry && <div className="min-w-0">
            <Label htmlFor="lesson_period_end" className="sr-only">Sampai jam pelajaran</Label>
            <SelectNative id="lesson_period_end" name="lesson_period_end" required value={endPeriod} disabled={!startPeriod || startExpired} onChange={(event) => setEndPeriod(event.target.value)} className={fieldClass}>
              <option value="" disabled>Pilih jam mapel selesai</option>
              {periods.filter((period) => period.number >= startNumber).map((period) => <option key={period.number} value={period.number}>{lessonPeriodLabel(period.number)}</option>)}
            </SelectNative>
          </div>}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-[#6f7380]">Berlaku untuk hari ini (WIB). Jam istirahat tidak dihitung.</p>
        {(allPeriodsEnded || startExpired) && <p role="status" className="mt-1 text-xs text-red-700">{allPeriodsEnded ? "Semua jam pelajaran hari ini sudah berakhir." : DISPENSATION_PERIOD_ENDED}</p>}
        {entry && <p className="mt-1 text-[10px] leading-relaxed text-[#6f7380]">Pilih satu jam pelajaran saat kamu akan masuk kelas.</p>}
        {timeLabel ? <p className="mt-1 text-[11px] text-[#555d65]">{timeLabel}</p> : null}
      </fieldset>
      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="evidence" className="text-[11px] font-medium">Bukti pendukung <span className="text-[#f00000]">*</span></Label>
        <div className={cn("relative min-w-0 rounded-lg border border-dashed px-4 py-4 focus-within:ring-2 focus-within:ring-red-200", fileError ? "border-red-500 bg-red-50" : "border-[#a5a7ae] hover:border-red-400")}>
          <input id="evidence" name="evidence" type="file" accept={EVIDENCE_MIME_TYPES.join(",")} required disabled={pending} aria-invalid={!!fileError} aria-describedby={fileError || evidence ? "evidence-hint evidence-state" : "evidence-hint"} className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              const message = file ? evidenceError(file.size, file.type) ?? "" : "";
              uploadRef.current = null;
              event.currentTarget.setCustomValidity(message);
              setFileError(message || null); setEvidence(file ? { name: file.name, size: file.size } : null);
            }} />
          <div aria-hidden className="pointer-events-none flex min-w-0 items-center justify-center gap-2 text-[11px] text-[#6f7380]">
            <span className="min-w-0 truncate">{evidence?.name ?? "Unggah screenshot chat atau bukti lainnya"}</span>
            {evidence && !fileError ? <Check className="size-4 shrink-0 text-green-600" /> : <Upload className="size-4 shrink-0 text-[#f00000]" />}
          </div>
        </div>
        <p id="evidence-hint" className="text-[10px] text-[#6f7380]">JPG, PNG, WebP, atau PDF, maksimal 5 MB.</p>
        {fileError || evidence ? <p id="evidence-state" role={fileError ? "alert" : "status"} className={cn("text-xs wrap-anywhere", fileError ? "text-red-600" : "text-[#6f7380]")}>{fileError ?? (evidence ? `${evidence.name} · ${(evidence.size / 1048576).toFixed(2)} MB` : "")}</p> : null}
      </div>
      {state.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="student-button" disabled={!canSubmit}>{pending ? (saving ? "Menyimpan pengajuan…" : "Mengunggah bukti…") : "Kirim Pengajuan"}</button>
        <Link href="/izin" className="inline-flex min-h-[38px] items-center justify-center rounded-full border border-zinc-700 px-6 text-xs hover:bg-zinc-50">Batal</Link>
      </div>
    </form>
    <aside aria-label="Informasi persetujuan" className="flex min-w-0 flex-col gap-5">
      <section className="student-panel p-5 sm:p-6">
        <h2 className="mb-3 text-xs font-semibold">Diproses oleh</h2>
        <ol className="divide-y divide-[#eceef2] text-xs">
          <li className="py-2 text-[#52a800]">{preview?.status === "fallback" ? "Wali kelas" : "Guru mata pelajaran"}<span className="float-right text-[10px]">Lapis 1</span></li>
          <li className="py-2 text-[#6f7380]">Wali kelas<span className="float-right text-[10px]">Lapis 2</span></li>
          <li className="py-2 text-[#6f7380]">Guru BK / Kesiswaan<span className="float-right text-[10px]">Lapis 3</span></li>
        </ol>
        <div aria-live="polite" className="mt-3 text-[11px] leading-relaxed text-[#6f7380]">
          <SchedulePreview preview={preview} pending={previewPending} entry={entry} />
        </div>
      </section>
      <section className="student-panel p-5 sm:p-6">
        <h2 className="mb-3 text-xs font-semibold">Setelah dikirim</h2>
        <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-[#6f7380]">
          <li>Guru memeriksa pengajuan.</li>
          <li>Status diperbarui setelah keputusan guru.</li>
          <li>Surat PDF ber-QR terbit jika disetujui.</li>
        </ol>
        <p className="mt-3 text-[10px] leading-relaxed text-[#6f7380]">Pengajuan diteruskan ke lapis berikutnya apabila belum ditanggapi.</p>
      </section>
    </aside>
  </div>;
}

function SchedulePreview({ preview, pending, entry }: { preview: LookupResult | null; pending: boolean; entry: boolean }) {
  if (pending) return <p>Memuat jadwal…</p>;
  if (!preview || preview.status === "choose_period") return <p>Pilih jam pelajaran untuk melihat guru penanggung jawab.</p>;
  if (preview.status === "found") return <p><span className="font-medium text-[#343b41]">{preview.teacher}</span><br />{preview.subject} · {preview.day}<br />Guru mengikuti jadwal pada {entry ? "jam masuk yang dipilih" : "jam awal"}.</p>;
  if (preview.status === "fallback") return <p className={preview.approver ? undefined : "text-red-600"}>{preview.approver ? `Tidak ada jadwal guru pada ${entry ? "jam masuk yang dipilih" : "jam awal"}. Pengajuan diproses wali kelas: ${preview.approver}.` : "Guru dan wali kelas belum tersedia. Hubungi Admin sebelum mengajukan izin."}</p>;
  return <p className="text-red-600">{preview.status === "error" ? preview.message : "Anda belum terdaftar di kelas. Hubungi Admin."}</p>;
}
