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
  REQUEST_STATUS,
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
  const submitted = await findSubmitted();
  if (submitted.error) return { error: "Status pengajuan belum dapat diperiksa. Silakan coba lagi." };
  if (submitted.data) return confirmSubmission();

  const routing = await lookupSchedule(parsed.data.lesson_period_start);
  if (routing.status === "no_class") return { error: "Anda belum terdaftar di kelas. Hubungi Admin sebelum mengajukan izin." };
  if (routing.status === "error") return { error: routing.message };
  if (routing.status === "fallback" && !routing.approver) return { error: "Guru pada jam pelajaran ini dan wali kelas belum tersedia. Hubungi Admin untuk melengkapi jadwal atau wali kelas." };

  // Cegah pengajuan dobel: satu pengajuan menunggu per jenis izin (migrasi 0012).
  const duplicateMsg = `Masih ada pengajuan "${IZIN_TYPE_LABELS[parsed.data.izin_type]}" yang menunggu persetujuan. Tunggu keputusannya atau batalkan dulu di menu Riwayat.`;
  const { data: pendingSame, error: pendingError } = await supabase
    .from("permission_requests")
    .select("id, evidence_url")
    .eq("student_id", profile.id)
    .eq("izin_type", parsed.data.izin_type)
    .eq("status", REQUEST_STATUS.PENDING)
    .limit(1)
    .maybeSingle();
  if (pendingError) {
    if (pendingError.code === "22P02" && parsed.data.izin_type === IZIN_TYPES.MASUK_KELAS) {
      return { error: "Izin Masuk Kelas belum diaktifkan di database. Hubungi admin untuk mengaktifkannya." };
    }
    return { error: "Pengajuan yang masih menunggu belum dapat diperiksa. Silakan coba lagi." };
  }
  if (pendingSame) {
    if (pendingSame.id === requestId.data && pendingSame.evidence_url === evidencePath) return confirmSubmission();
    return { error: duplicateMsg };
  }

  const { data: stored, error: storageError } = await supabase.storage
    .from(STORAGE_BUCKETS.EVIDENCE).info(evidencePath);
  if (storageError || !stored) {
    return { error: "Bukti belum dapat diperiksa. Coba kirim lagi atau pilih kembali berkasnya." };
  }
  const validationError = evidenceError(stored.size ?? stored.metadata?.size, stored.contentType ?? stored.metadata?.mimetype);
  if (validationError) return { error: validationError };

  const { requestedAt, requestedUntil } = lessonRangeTime(parsed.data.lesson_period_start, parsed.data.lesson_period_end);

  // Insert pengajuan dalam kondisi awal bersih. Kolom status/current_layer &
  // approver dibiarkan default (pending, lapis 1, null) sesuai policy RLS.
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
      return { error: duplicateMsg };
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
  const profile = await getProfile();
  if (!profile || profile.role !== ROLES.SISWA || !profile.class_id) return { status: "no_class" };
  const parsedPeriod = z.coerce.number().int().min(1).max(11).safeParse(periodNumber);
  if (!parsedPeriod.success) return { status: "choose_period" };

  const { day: dow, time, period } = lessonRequestTime(parsedPeriod.data);
  const dayLabel = DAY_LABELS[dow] ?? "";

  // Service role: hanya membaca jadwal/guru untuk kelas siswa itu sendiri.
  const admin = createAdminClient();
  const { data: daySchedules, error: schedulesError } = await admin
    .from("schedules")
    .select("id, subject_id, teacher_id, start_time, end_time")
    .eq("class_id", profile.class_id)
    .eq("day_of_week", dow)
    .order("start_time", { ascending: true });
  if (schedulesError) return { status: "error", message: "Jadwal belum dapat dibaca. Silakan coba lagi sebelum mengirim pengajuan." };

  const list = daySchedules ?? [];
  const idx = list.findIndex((s) => s.teacher_id && time >= s.start_time && time < s.end_time);

  if (idx === -1) {
    const { data: klass, error: classError } = await admin
      .from("classes")
      .select("homeroom_teacher_id")
      .eq("id", profile.class_id)
      .maybeSingle();
    if (classError) return { status: "error", message: "Data wali kelas belum dapat dibaca. Silakan coba lagi." };
    let approver: string | null = null;
    if (klass?.homeroom_teacher_id) {
      const { data: t, error: teacherError } = await admin
        .from("profiles")
        .select("full_name, role")
        .eq("id", klass.homeroom_teacher_id)
        .maybeSingle();
      if (teacherError) return { status: "error", message: "Data wali kelas belum dapat dibaca. Silakan coba lagi." };
      approver = t?.role && t.role !== ROLES.SISWA ? t.full_name : null;
    }
    return { status: "fallback", day: dayLabel, approver };
  }

  const match = list[idx];
  let subject: string | null = null;
  let teacher: string | null = null;
  if (match.subject_id) {
    const { data: s, error } = await admin
      .from("subjects")
      .select("name")
      .eq("id", match.subject_id)
      .maybeSingle();
    if (error) return { status: "error", message: "Data mata pelajaran belum dapat dibaca. Silakan coba lagi." };
    subject = s?.name ?? null;
  }
  if (match.teacher_id) {
    const { data: t, error } = await admin
      .from("profiles")
      .select("full_name, role")
      .eq("id", match.teacher_id)
      .maybeSingle();
    if (error || !t || t.role === ROLES.SISWA) return { status: "error", message: "Guru penanggung jawab pada jadwal belum tersedia. Hubungi Admin." };
    teacher = t?.full_name ?? null;
  }

  return {
    status: "found",
    subject,
    teacher,
    period: period.number,
    start: period.start,
    end: period.end,
    day: dayLabel,
  };
}
