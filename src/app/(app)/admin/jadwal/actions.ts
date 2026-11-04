"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { ADMIN_SCHEDULES_PATH, ROLES } from "@/lib/constants";
import { getLessonPeriod } from "@/features/izin/lesson-periods";

export type FormState = { error?: string; ok?: boolean };

async function isAdmin(): Promise<boolean> {
  const profile = await getProfile();
  return profile?.role === ROLES.ADMIN;
}

const scheduleSchema = z.object({
  class_id: z.uuid("Kelas wajib dipilih"),
  subject_id: z.uuid("Mata pelajaran wajib dipilih"),
  teacher_id: z.uuid("Guru wajib dipilih"),
  day_of_week: z.coerce.number().int().min(1).max(7),
  start_period: z.coerce.number().int().min(1, "Pilih jam pelajaran awal").max(11),
  end_period: z.coerce.number().int().min(1, "Pilih jam pelajaran akhir").max(11),
});

export async function createSchedule(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await isAdmin())) return { error: "Hanya admin yang dapat mengubah jadwal." };

  const parsed = scheduleSchema.safeParse({
    class_id: formData.get("class_id"),
    subject_id: formData.get("subject_id"),
    teacher_id: formData.get("teacher_id"),
    day_of_week: formData.get("day_of_week"),
    start_period: formData.get("start_period"),
    end_period: formData.get("end_period"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }
  if (parsed.data.end_period < parsed.data.start_period) {
    return { error: "Jam pelajaran akhir tidak boleh sebelum jam pelajaran awal." };
  }

  const supabase = await createClient();
  const { start_period, end_period, ...schedule } = parsed.data;
  const { error } = await supabase.from("schedules").insert({ ...schedule,
    start_time: getLessonPeriod(start_period)!.start,
    end_time: getLessonPeriod(end_period)!.end,
  });
  if (error) {
    // 23P01 = melanggar constraint schedules_no_overlap (migrasi 0012).
    return {
      error:
        error.code === "23P01"
          ? "Jadwal bentrok: kelas ini sudah punya pelajaran yang jamnya tumpang tindih pada hari tersebut."
          : error.message,
    };
  }

  revalidatePath(ADMIN_SCHEDULES_PATH);
  return { ok: true };
}

const subjectSchema = z.object({
  name: z.string().trim().min(1, "Nama mapel wajib diisi").max(100),
  code: z.string().trim().max(20).optional(),
});

export async function createSubject(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await isAdmin())) return { error: "Hanya admin." };

  const parsed = subjectSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("subjects")
    .insert({
      name: parsed.data.name.replace(/s+/g, " "),
      code: parsed.data.code || null,
    });
  if (error) {
    return {
      error: error.code === "23505" ? "Mata pelajaran sudah ada." : error.message,
    };
  }

  revalidatePath(ADMIN_SCHEDULES_PATH);
  return { ok: true };
}

export async function deleteSchedule(id: string) {
  if (!(await isAdmin())) return;
  const supabase = await createClient();
  await supabase.from("schedules").delete().eq("id", id);
  revalidatePath(ADMIN_SCHEDULES_PATH);
}

export async function deleteSubject(id: string) {
  if (!(await isAdmin())) return;
  const supabase = await createClient();
  await supabase.from("subjects").delete().eq("id", id);
  revalidatePath(ADMIN_SCHEDULES_PATH);
}
