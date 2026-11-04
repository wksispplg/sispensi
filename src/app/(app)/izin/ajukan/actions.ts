"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { lessonRequestTime, lessonRangeTime } from "@/features/izin/lesson-periods";
import {
  DAY_LABELS,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MIME_TYPES,
  IZIN_TYPES,
  IZIN_TYPE_LABELS,
  REQUEST_STATUS,
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
    .max(1000, "Alasan maksimal 1000 karakter"),
  lesson_period_start: z.coerce.number().int().min(1, "Pilih jam pelajaran awal.").max(11),
  lesson_period_end: z.coerce.number().int().min(1, "Pilih jam pelajaran akhir.").max(11),
}).refine((value) => value.lesson_period_end >= value.lesson_period_start, { message: "Jam pelajaran akhir tidak boleh sebelum jam awal.", path: ["lesson_period_end"] });

export type CreateState = { error?: string };

export async function createPermissionRequest(
  _prevState: CreateState,
  formData: FormData,
): Promise<CreateState> {
  const profile = await getProfile();
  if (!profile) return { error: "Sesi tidak valid. Silakan login ulang." };
  if (profile.role !== ROLES.SISWA) {
    return { error: "Hanya siswa yang dapat mengajukan izin." };
  }

  const parsed = requestSchema.safeParse({
    izin_type: formData.get("izin_type"),
    reason: formData.get("reason"),
    lesson_period_start: formData.get("lesson_period_start"),
    lesson_period_end: formData.get("lesson_period_end"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }

  const routing = await lookupSchedule(parsed.data.lesson_period_start);
  if (routing.status === "no_class") return { error: "Anda belum terdaftar di kelas. Hubungi Admin sebelum mengajukan izin." };
  if (routing.status === "error") return { error: routing.message };
  if (routing.status === "fallback" && !routing.approver) return { error: "Guru pada jam pelajaran ini dan wali kelas belum tersedia. Hubungi Admin untuk melengkapi jadwal atau wali kelas." };

  const supabase = await createClient();

  // Cegah pengajuan dobel: satu pengajuan menunggu per jenis izin. Dicek di sini
  // agar bukti tidak sempat diunggah; DB juga menjaganya (migrasi 0012).
  const duplicateMsg = `Masih ada pengajuan "${IZIN_TYPE_LABELS[parsed.data.izin_type]}" yang menunggu persetujuan. Tunggu keputusannya atau batalkan dulu di menu Riwayat.`;
  const { data: pendingSame } = await supabase
    .from("permission_requests")
    .select("id")
    .eq("student_id", profile.id)
    .eq("izin_type", parsed.data.izin_type)
    .eq("status", REQUEST_STATUS.PENDING)
    .limit(1)
    .maybeSingle();
  if (pendingSame) return { error: duplicateMsg };

  // Upload bukti (WAJIB — antisipasi izin fiktif / siswa berbohong).
  const file = formData.get("evidence");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Bukti pendukung wajib dilampirkan." };
  }
  if (file.size > EVIDENCE_MAX_BYTES) {
    return { error: "Ukuran bukti maksimal 5MB." };
  }
  if (!EVIDENCE_MIME_TYPES.includes(file.type)) {
    return { error: "Bukti harus berupa gambar (JPG/PNG/WebP) atau PDF." };
  }
  const ext = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
  // Konvensi path: "<user_id>/<uuid>.<ext>" (folder pertama = pemilik, sesuai policy Storage)
  const evidencePath = `${profile.id}/${crypto.randomUUID()}${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.EVIDENCE)
    .upload(evidencePath, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    return { error: `Gagal mengunggah bukti: ${uploadError.message}` };
  }

  const { requestedAt, requestedUntil } = lessonRangeTime(parsed.data.lesson_period_start, parsed.data.lesson_period_end);

  // Insert pengajuan dalam kondisi awal bersih. Kolom status/current_layer &
  // approver dibiarkan default (pending, lapis 1, null) sesuai policy RLS.
  const { error: insertError } = await supabase
    .from("permission_requests")
    .insert({
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
    // Best-effort: hapus bukti yang sudah terlanjur diunggah
    if (evidencePath) {
      await supabase.storage
        .from(STORAGE_BUCKETS.EVIDENCE)
        .remove([evidencePath]);
    }
    // 23505 = dua pengajuan dikirim bersamaan (mis. dari dua tab).
    if (insertError.code === "23505") return { error: duplicateMsg };
    if (insertError.code === "PGRST204" || insertError.code === "42703") return { error: "Form izin memerlukan pembaruan database. Hubungi administrator SIPENSI." };
    return { error: `Gagal menyimpan pengajuan: ${insertError.message}` };
  }

  revalidatePath("/izin");
  revalidatePath("/persetujuan");
  redirect("/izin?ok=1");
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
