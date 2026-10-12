"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectNative } from "@/components/ui/select-native";
import {
  Card,
  CardContent,
  CardDescription,
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
    <div className="bg-muted/30 rounded-md border border-dashed px-3 py-2 text-sm">
      {!preview || pending ? (
        <p className="text-muted-foreground">Memuat jadwal…</p>
      ) : preview?.status === "found" ? (
        <div className="flex items-start gap-2">
          <CalendarClock className="text-primary mt-0.5 size-4 shrink-0" />
          <div>
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
  const [fileError, setFileError] = useState<string | null>(null);
  const [preview, setPreview] = useState<LookupResult | null>(null);
  const [previewPending, startPreview] = useTransition();

  // Ambil jadwal untuk waktu terpilih (debounce). Kosong = sekarang.
  useEffect(() => {
    const handle = setTimeout(() => {
      startPreview(async () => {
        setPreview(await lookupSchedule(waktu));
      });
    }, 350);
    return () => clearTimeout(handle);
  }, [waktu]);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <Link
        href="/izin"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        Kembali ke riwayat
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Ajukan Izin</CardTitle>
          <CardDescription>
            Isi detail izin Anda. Setelah dikirim, pengajuan akan diproses sesuai
            alur persetujuan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form {...formProps} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="izin_type">Jenis izin</Label>
              <SelectNative
                id="izin_type"
                name="izin_type"
                required
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

            {isTimerIzin(izinType as IzinType) ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="duration_minutes">
                  Perkiraan durasi keluar{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <SelectNative
                  id="duration_minutes"
                  name="duration_minutes"
                  required
                  defaultValue="30"
                >
                  {DISPEN_DURATION_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m} menit
                    </option>
                  ))}
                </SelectNative>
                <p className="text-muted-foreground text-xs">
                  Hitung mundur mulai berjalan saat Anda menekan “Mulai Dispen”
                  setelah izin disetujui.
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="requested_at">Waktu izin</Label>
              <Input
                id="requested_at"
                name="requested_at"
                type="datetime-local"
                value={waktu}
                onChange={(e) => setWaktu(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Kosongkan bila izin berlaku mulai sekarang.
              </p>
              <SchedulePreview preview={preview} pending={previewPending} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="reason">Alasan</Label>
              <Textarea
                id="reason"
                name="reason"
                required
                minLength={5}
                maxLength={1000}
                rows={4}
                placeholder="Jelaskan alasan izin Anda…"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="evidence">
                Bukti pendukung <span className="text-destructive">*</span>
              </Label>
              <Input
                id="evidence"
                name="evidence"
                type="file"
                accept={EVIDENCE_MIME_TYPES.join(",")}
                required
                aria-invalid={fileError ? true : undefined}
                aria-describedby="evidence-hint"
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
                }}
              />
              {fileError ? (
                <p role="alert" className="text-destructive text-sm">
                  {fileError}
                </p>
              ) : null}
              <p id="evidence-hint" className="text-muted-foreground text-xs">
                Wajib dilampirkan untuk mencegah izin fiktif. Gambar
                (JPG/PNG/WebP) atau PDF, maksimal 5MB.
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

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? "Mengirim…" : "Kirim Pengajuan"}
              </Button>
              <Button type="button" variant="ghost" asChild>
                <Link href="/izin">Batal</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
