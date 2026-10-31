"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  FileText,
  Send,
  UploadCloud,
  UserRound,
} from "lucide-react";

import {
  createPermissionRequest,
  lookupSchedule,
  type CreateState,
  type LookupResult,
} from "./actions";
import {
  DISPEN_DURATION_OPTIONS,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MIME_TYPES,
  IZIN_TYPE_LABELS,
  isTimerIzin,
  type IzinType,
} from "@/lib/constants";
import { useFormAction } from "@/hooks/use-form-action";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectNative } from "@/components/ui/select-native";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initialState: CreateState = {};

function SchedulePreview({
  preview,
  pending,
}: {
  preview: LookupResult | null;
  pending: boolean;
}) {
  return (
    <div className="min-w-0 text-sm leading-relaxed wrap-anywhere" aria-live="polite">
      {!preview || pending ? (
        <p className="text-muted-foreground">Memuat jadwal…</p>
      ) : preview?.status === "found" ? (
        <div className="flex items-start gap-2">
          <CalendarClock className="text-primary mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium">{preview.subject ?? "Mata pelajaran"}</p>
            <p className="text-muted-foreground text-xs">
              {preview.day} · Jam ke-{preview.period} ({preview.start}–
              {preview.end})
              {preview.teacher ? ` · ${preview.teacher}` : ""}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Izin akan diproses guru tersebut (Lapis 1).
            </p>
          </div>
        </div>
      ) : preview?.status === "fallback" ? (
        <p className="text-muted-foreground">
          Tidak ada jadwal pelajaran pada {preview.day} jam itu — izin diproses{" "}
          <span className="text-foreground font-medium">Wali Kelas</span>
          {preview.approver ? ` (${preview.approver})` : ""}.
        </p>
      ) : preview?.status === "no_class" ? (
        <p className="text-muted-foreground">
          Anda belum terdaftar di kelas — hubungi Admin agar izin bisa
          diarahkan.
        </p>
      ) : null}
    </div>
  );
}

export default function AjukanIzinPage() {
  const [state, formProps, pending] = useFormAction(
    createPermissionRequest,
    initialState,
  );

  const [izinType, setIzinType] = useState("");
  const [waktu, setWaktu] = useState("");
  const [duration, setDuration] = useState("30");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState<{
    name: string;
    size: number;
  } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [preview, setPreview] = useState<LookupResult | null>(null);
  const [previewPending, startPreview] = useTransition();

  // Ambil jadwal untuk waktu terpilih (debounce). Kosong = sekarang.
  useEffect(() => {
    let active = true;
    const handle = setTimeout(() => {
      startPreview(async () => {
        const result = await lookupSchedule(waktu);
        if (active) setPreview(result);
      });
    }, 350);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [waktu]);

  const useTimer = isTimerIzin(izinType as IzinType);
  const selectedTime = waktu ? new Date(waktu) : null;
  const timeLabel =
    selectedTime && !Number.isNaN(selectedTime.getTime())
      ? new Intl.DateTimeFormat("id-ID", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(selectedTime)
      : "Mulai sekarang";

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 pt-2 lg:pt-4">
      <Link
        href="/izin"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Kembali ke riwayat
      </Link>

      <form
        {...formProps}
        className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]"
      >
        <Card className="gap-0 overflow-hidden rounded-2xl border-zinc-200 py-0 shadow-none">
          <CardHeader className="flex flex-row items-start gap-3 border-b border-zinc-100 p-5 sm:p-6">
            <span className="bg-brand/8 text-brand flex size-10 shrink-0 items-center justify-center rounded-xl">
              <FileText className="size-5" strokeWidth={1.7} aria-hidden />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-base leading-6">Detail pengajuan</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                Lengkapi informasi izin dan lampirkan bukti pendukung.
              </p>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-6 p-5 sm:p-6">
            <div className="grid min-w-0 gap-5 xl:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="izin_type">
                  Jenis izin <span className="text-destructive">*</span>
                </Label>
                <SelectNative
                  id="izin_type"
                  name="izin_type"
                  required
                  className="h-12 rounded-xl border-zinc-200 bg-white shadow-none md:h-12"
                  value={izinType}
                  onChange={(e) => setIzinType(e.target.value)}
                >
                  <option value="" disabled>
                    Pilih jenis izin…
                  </option>
                  {Object.entries(IZIN_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectNative>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="requested_at">Waktu izin</Label>
                <Input
                  id="requested_at"
                  name="requested_at"
                  type="datetime-local"
                  className="h-12 rounded-xl border-zinc-200 bg-white shadow-none md:h-12"
                  value={waktu}
                  onChange={(e) => setWaktu(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  Kosongkan bila izin berlaku mulai sekarang.
                </p>
              </div>
            </div>

            {useTimer ? (
              <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 p-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="duration_minutes">
                    Perkiraan durasi keluar <span className="text-destructive">*</span>
                  </Label>
                  <SelectNative
                    id="duration_minutes"
                    name="duration_minutes"
                    required
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="h-12 rounded-xl border-amber-200 bg-white shadow-none md:h-12"
                  >
                    {DISPEN_DURATION_OPTIONS.map((m) => (
                      <option key={m} value={m}>{m} menit</option>
                    ))}
                  </SelectNative>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Hitung mundur dimulai saat Anda menekan “Mulai Dispen” setelah izin disetujui.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="reason">
                  Alasan izin <span className="text-destructive">*</span>
                </Label>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {reason.length}/1000
                </span>
              </div>
              <Textarea
                id="reason"
                name="reason"
                required
                minLength={5}
                maxLength={1000}
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-36 resize-y rounded-xl border-zinc-200 bg-white p-3.5 leading-relaxed shadow-none"
                placeholder="Jelaskan keperluan Anda secara singkat dan jelas…"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="evidence">
                Bukti pendukung <span className="text-destructive">*</span>
              </Label>
              <div
                className={cn(
                  "relative rounded-xl border border-dashed p-5 transition-colors focus-within:ring-2 focus-within:ring-brand/30 sm:p-6",
                  fileError
                    ? "border-destructive bg-red-50/40"
                    : "border-zinc-300 bg-zinc-50/70 hover:border-brand/50 hover:bg-red-50/30",
                )}
              >
                <input
                  id="evidence"
                  name="evidence"
                  type="file"
                  accept={EVIDENCE_MIME_TYPES.join(",")}
                  required
                  aria-invalid={fileError ? true : undefined}
                  aria-describedby={fileError ? "evidence-hint evidence-error" : "evidence-hint"}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={(e) => {
                    // Cek di browser dulu agar file besar tidak sempat diunggah.
                    const f = e.currentTarget.files?.[0];
                    const msg = !f
                      ? ""
                      : f.size > EVIDENCE_MAX_BYTES
                        ? `Ukuran file ${(f.size / 1048576).toFixed(1)}MB — maksimal 5MB.`
                        : !EVIDENCE_MIME_TYPES.includes(f.type)
                          ? "Format harus JPG, PNG, WebP, atau PDF."
                          : "";
                    e.currentTarget.setCustomValidity(msg);
                    setFileError(msg || null);
                    setEvidence(f ? { name: f.name, size: f.size } : null);
                  }}
                />
                <div aria-hidden className="pointer-events-none flex min-w-0 flex-col items-center gap-2 text-center">
                  <span className={cn(
                    "flex size-11 items-center justify-center rounded-xl bg-white",
                    evidence && !fileError ? "text-emerald-600" : "text-brand",
                  )}>
                    {evidence && !fileError ? (
                      <CheckCircle2 className="size-5" />
                    ) : (
                      <UploadCloud className="size-5" />
                    )}
                  </span>
                  <p className="max-w-full text-sm font-medium wrap-anywhere">
                    {evidence?.name ?? "Klik untuk memilih bukti pendukung"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {evidence ? `${(evidence.size / 1048576).toFixed(2)} MB · Klik untuk mengganti berkas` : "JPG, PNG, WebP, atau PDF · Maksimal 5 MB"}
                  </p>
                </div>
              </div>
              {fileError ? (
                <p id="evidence-error" role="alert" className="text-destructive text-sm">
                  {fileError}
                </p>
              ) : null}
              <p id="evidence-hint" className="text-muted-foreground text-xs">
                Lampirkan dokumen atau foto yang mendukung alasan izin Anda.
              </p>
            </div>

            {state.error ? (
              <p
                role="alert"
                className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm"
              >
                {state.error}
              </p>
            ) : null}
          </CardContent>
          <div className="flex flex-col gap-4 border-t border-zinc-100 bg-zinc-50/70 px-5 py-4 sm:px-6">
            <p className="text-muted-foreground text-xs leading-relaxed">
              Pastikan informasi sudah benar sebelum mengirim pengajuan.
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" asChild className="h-11 rounded-xl bg-white px-5 md:h-11">
                <Link href="/izin">Batal</Link>
              </Button>
              <Button type="submit" disabled={pending} className="h-11 rounded-xl px-5 md:h-11">
                <Send className="size-4" aria-hidden />
                {pending ? "Mengirim…" : "Kirim Pengajuan"}
              </Button>
            </div>
          </div>
        </Card>

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6" aria-label="Ringkasan dan informasi pengajuan">
          <Card className="gap-4 rounded-2xl border-zinc-200 py-5 shadow-none">
            <CardHeader className="gap-2 px-5">
              <p className="text-brand text-[10px] font-semibold tracking-wider uppercase">
                {pending ? "Sedang dikirim" : "Belum dikirim"}
              </p>
              <CardTitle className="text-base leading-6">Ringkasan izin</CardTitle>
            </CardHeader>
            <CardContent className="px-5">
              <dl className="flex flex-col gap-4 text-sm">
                <SummaryItem label="Jenis izin" value={IZIN_TYPE_LABELS[izinType as IzinType] || "Belum dipilih"} />
                <SummaryItem label="Waktu izin" value={timeLabel} />
                {useTimer ? <SummaryItem label="Durasi keluar" value={`${duration} menit`} /> : null}
                <SummaryItem label="Bukti pendukung" value={fileError ? "Periksa kembali lampiran" : evidence?.name || "Belum dilampirkan"} />
              </dl>
            </CardContent>
          </Card>

          <Card className="gap-3 rounded-2xl border-zinc-200 py-5 shadow-none">
            <CardHeader className="flex flex-row items-center gap-2 px-5">
              <UserRound className="text-brand size-4 shrink-0" aria-hidden />
              <CardTitle className="text-sm leading-5">Penanggung jawab</CardTitle>
            </CardHeader>
            <CardContent className="px-5">
              <SchedulePreview preview={preview} pending={previewPending} />
            </CardContent>
          </Card>

          <div className="flex items-start gap-2.5 px-1 text-sm">
            <FileCheck2 className="text-brand mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="text-muted-foreground text-xs leading-relaxed">
              Pantau status di <Link href="/izin" className="text-foreground font-medium underline-offset-4 hover:underline">Riwayat Pengajuan</Link>.
              Jika disetujui, surat izin dapat diunduh dari sana.
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 font-medium leading-relaxed wrap-anywhere">{value}</dd>
    </div>
  );
}
