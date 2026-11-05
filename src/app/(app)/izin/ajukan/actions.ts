"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { lessonRequestTime, lessonRangeTime } from "@/features/izin/lesson-periods";
import { evidenceError } from "@/features/izin/evidence";
import {
  DAY_LABELS,
  IZIN_TYPES,
  IZIN_TYPE_LABELS,
  REQUEST_TITLE_MAX_LENGTH,
  REQUEST_REASON_MAX_LENGTH,
  ROLES,
  STORAGE_BUCKETS,
  type IzinType,
} from "@/lib/constants";

const IZIN_VALUES = Object.values(IZIN_TYPES) as [IzinType, ...IzinType[]];

const requestSchema = z.object({
  izin_type: z.enum(IZIN_VALUES, { error: "Jenis izin tidak valid" }),
  reason: z
    .string()
    .trim()
    .min(5, "Alasan minimal 5 karakter")
    .max(REQUEST_REASON_MAX_LENGTH, "Alasan maksimal 1000 karakter"),
  lesson_period_start: z.coerce.number().int().min(1, "Pilih jam pelajaran awal.").max(11),
  lesson_period_end: z.coerce.number().int().min(1, "Pilih jam pelajaran akhir.").max(11),
}).refine((value) => value.lesson_period_end >= value.lesson_period_start, { message: "Jam pelajaran akhir tidak boleh sebelum jam awal.", path: ["lesson_period_end"] });

export type CreateState = { error?: string; ok?: boolean };

function confirmSubmission(): CreateState {
  revalidatePath("/izin");
  revalidatePath("/dashboard");
  revalidatePath("/persetujuan");
  return { ok: true };
}

export async function createPermissionRequest(
  _prevState: CreateState,
  formData: FormData,
): Promise<CreateState> {
  const profile = await getProfile();
  if (!profile) return { error: "Sesi tidak valid. Silakan login ulang." };
  if (profile.role !== ROLES.SISWA) {
    return { error: "Hanya siswa yang dapat mengajukan izin." };
  }

  const rawTitle = formData.get("reason");
  const rawDetail = formData.get("reason_detail");
  if (typeof rawTitle !== "string" || (rawDetail !== null && typeof rawDetail !== "string")) return { error: "Alasan tidak valid." };
  const title = rawTitle.trim();
  const detail = (rawDetail ?? "").trim();
  if (formData.has("reason_detail") && title.length < 5) return { error: "Alasan singkat minimal 5 karakter." };
  if (formData.has("reason_detail") && title.length > REQUEST_TITLE_MAX_LENGTH) {
    return { error: `Alasan singkat maksimal ${REQUEST_TITLE_MAX_LENGTH} karakter.` };
  }
  const reason = detail ? `${title}\n${detail}` : title;
  if (reason.length > REQUEST_REASON_MAX_LENGTH) return { error: `Alasan dan detail maksimal ${REQUEST_REASON_MAX_LENGTH} karakter.` };

  const parsed = requestSchema.safeParse({
    izin_type: formData.get("izin_type"),
    reason,
    lesson_period_start: formData.get("lesson_period_start"),
    // Izin masuk selalu satu jam mapel, termasuk bila browser mengirim jam akhir lain.
    lesson_period_end: formData.get("izin_type") === IZIN_TYPES.MASUK_KELAS
      ? formData.get("lesson_period_start")
      : formData.get("lesson_period_end"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }
  if (!profile.class_id) {
    return { error: "Anda belum terdaftar di kelas. Hubungi Admin sebelum mengajukan izin." };
  }

  const evidencePath = formData.get("evidence_path");
  const ownerPrefix = `${profile.id}/`;
  if (typeof evidencePath !== "string" || !evidencePath.startsWith(ownerPrefix)) {
    return { error: "Bukti pendukung wajib dilampirkan dari akunmu." };
  }
  const fileName = /^([a-f0-9-]{36})\.(?:jpg|png|webp|pdf)$/.exec(evidencePath.slice(ownerPrefix.length));
  const requestId = z.uuid().safeParse(fileName?.[1]);
  if (!requestId.success) return { error: "Bukti tidak valid. Silakan pilih kembali berkasnya." };

  const supabase = await createClient();
  // ID unggahan menjadi ID pengajuan agar kirim ulang setelah koneksi putus tetap aman.
  const findSubmitted = () => supabase.from("permission_requests")
    .select("id")
    .eq("id", requestId.data)
    .eq("student_id", profile.id)
    .eq("evidence_url", evidencePath)
    .maybeSingle();

  const { data: stored, error: storageError } = await supabase.storage
    .from(STORAGE_BUCKETS.EVIDENCE).info(evidencePath);
  const validationError = storageError || !stored
    ? "Bukti belum dapat diperiksa. Coba kirim lagi atau pilih kembali berkasnya."
    : evidenceError(stored.size ?? stored.metadata?.size, stored.contentType ?? stored.metadata?.mimetype);
  if (validationError) {
    const submitted = await findSubmitted();
    if (submitted.data) return confirmSubmission();
    return { error: validationError };
  }

  const { requestedAt, requestedUntil } = lessonRangeTime(parsed.data.lesson_period_start, parsed.data.lesson_period_end);

  // Database memeriksa duplikat dan menetapkan guru dalam transaksi yang sama.
  const { error: insertError } = await supabase
    .from("permission_requests")
    .insert({
      id: requestId.data,
      student_id: profile.id,
      class_id: profile.class_id,
      izin_type: parsed.data.izin_type,
      reason: parsed.data.reason,
      requested_at: requestedAt,
      requested_until: requestedUntil,
      lesson_period_start: parsed.data.lesson_period_start,
      lesson_period_end: parsed.data.lesson_period_end,
      evidence_url: evidencePath,
    });

  if (insertError) {
    if (insertError.code === "23505") {
      const retry = await findSubmitted();
      if (retry.data) return confirmSubmission();
      if (retry.error) return { error: "Status pengajuan belum dapat diperiksa. Silakan coba lagi." };
      return { error: `Masih ada pengajuan "${IZIN_TYPE_LABELS[parsed.data.izin_type]}" yang menunggu persetujuan. Tunggu keputusannya atau batalkan dulu di menu Riwayat.` };
    }
    if (insertError.code === "P0001" && insertError.message.includes("wali kelas belum tersedia")) {
      return { error: "Guru pada jam pelajaran ini dan wali kelas belum tersedia. Hubungi Admin untuk melengkapi jadwal atau wali kelas." };
    }
    if (insertError.code === "22P02" && parsed.data.izin_type === IZIN_TYPES.MASUK_KELAS) {
      return { error: "Izin Masuk Kelas belum diaktifkan di database. Hubungi admin untuk mengaktifkannya." };
    }
    if (insertError.code === "PGRST204" || insertError.code === "42703") return { error: "Form izin memerlukan pembaruan database. Hubungi administrator SIPENSI." };
    return { error: `Gagal menyimpan pengajuan: ${insertError.message}` };
  }

  return confirmSubmission();
}

// ==========================================================================
// Preview jadwal saat siswa memilih waktu izin (FR-3, informatif)
// ==========================================================================
export type LookupResult =
  | {
      status: "found";
      subject: string | null;
      teacher: string | null;
      period: number;
      start: string;
      end: string;
      day: string;
    }
  | { status: "fallback"; day: string; approver: string | null }
  | { status: "choose_period" }
  | { status: "error"; message: string }
  | { status: "no_class" };

export async function lookupSchedule(periodNumber: number | string): Promise<LookupResult> {
  const parsedPeriod = z.coerce.number().int().min(1).max(11).safeParse(periodNumber);
  if (!parsedPeriod.success) return { status: "choose_period" };
  const profile = await getProfile();
  if (!profile || profile.role !== ROLES.SISWA || !profile.class_id) return { status: "no_class" };

  const { day: dow, time, period } = lessonRequestTime(parsedPeriod.data);
  const dayLabel = DAY_LABELS[dow] ?? "";

  // Service role: hanya membaca jadwal/guru untuk kelas siswa itu sendiri.
  const admin = createAdminClient();
  const { data: klass, error: schedulesError } = await admin
    .from("classes")
    .select(`
      homeroom:profiles!classes_homeroom_teacher_id_fkey(full_name, role),
      schedules(
        teacher:profiles!schedules_teacher_id_fkey(full_name, role),
        subject:subjects(name)
      )
    `)
    .eq("id", profile.class_id)
    .eq("schedules.day_of_week", dow)
    .lte("schedules.start_time", time)
    .gt("schedules.end_time", time)
    .order("start_time", { referencedTable: "schedules", ascending: true })
    .order("id", { referencedTable: "schedules", ascending: true })
    .maybeSingle();
  if (schedulesError) return { status: "error", message: "Jadwal belum dapat dibaca. Silakan coba lagi sebelum mengirim pengajuan." };
  if (!klass) return { status: "no_class" };
  const match = klass.schedules.find((schedule) => schedule.teacher && schedule.teacher.role !== ROLES.SISWA);
  if (!match) {
    const approver = klass.homeroom && klass.homeroom.role !== ROLES.SISWA ? klass.homeroom.full_name : null;
    return { status: "fallback", day: dayLabel, approver };
  }

  return {
    status: "found",
    subject: match.subject?.name ?? null,
    teacher: match.teacher?.full_name ?? null,
    period: period.number,
    start: period.start,
    end: period.end,
    day: dayLabel,
  };
}
