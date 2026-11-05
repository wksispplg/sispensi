"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { ADMIN_STUDENTS_PATH, ROLES } from "@/lib/constants";
import { parseSheet, pickField } from "@/features/data-master/spreadsheet";

export type FormState = { error?: string; ok?: boolean };
export type ImportState = {
  error?: string;
  ok?: boolean;
  created?: number;
  failed?: number;
  errors?: string[];
};

async function isAdmin(): Promise<boolean> {
  const p = await getProfile();
  return p?.role === ROLES.ADMIN;
}

const studentSchema = z.object({
  full_name: z.string().trim().min(1, "Nama wajib diisi").max(100),
  email: z.email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  class_id: z.string().trim().optional(),
  nis: z.string().trim().max(30).optional(),
});

const studentProfileSchema = studentSchema.pick({ full_name: true, nis: true }).extend({
  class_id: z.union([z.literal(""), z.uuid()], { error: "Kelas tidak valid." }),
});

const studentLoginSchema = z.object({
  email: z.string().trim().pipe(z.email("Email tidak valid")),
  password: studentSchema.shape.password
    .refine((value) => value.trim().length > 0, "Password tidak boleh hanya berisi spasi.")
    .refine((value) => new TextEncoder().encode(value).length <= 72, "Password maksimal 72 byte.")
    .or(z.literal("")),
});

export async function updateStudentProfile(
  id: string,
  updatedAt: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await isAdmin())) return { error: "Hanya admin." };
  if (!z.uuid().safeParse(id).success) return { error: "Akun siswa tidak ditemukan." };
  const parsed = studentProfileSchema.safeParse({
    full_name: formData.get("full_name"),
    nis: formData.get("nis"),
    class_id: formData.get("class_id"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Input tidak valid." };

  const { full_name, nis, class_id } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles")
    .update({ full_name, nis: nis || null, class_id: class_id || null })
    .eq("id", id)
    .eq("role", ROLES.SISWA)
    .eq("updated_at", updatedAt)
    .select("id")
    .maybeSingle();
  if (error?.code === "23505") return { error: "NIS sudah dipakai akun lain." };
  if (error?.code === "23503") return { error: "Kelas tidak tersedia. Pilih kelas lain." };
  if (error) return { error: "Data siswa gagal disimpan. Silakan coba lagi." };
  if (!data) return { error: "Data siswa sudah berubah atau akun tidak tersedia. Muat ulang halaman." };

  revalidatePath(ADMIN_STUDENTS_PATH);
  revalidatePath(`${ADMIN_STUDENTS_PATH}/${id}/edit`);
  return { ok: true };
}

export async function updateStudentLogin(
  id: string,
  originalEmail: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await isAdmin())) return { error: "Hanya admin." };
  if (!z.uuid().safeParse(id).success) return { error: "Akun siswa tidak ditemukan." };
  const parsed = studentLoginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Input tidak valid." };

  const supabase = await createClient();
  const { data: student, error: studentError } = await supabase.from("profiles")
    .select("id").eq("id", id).eq("role", ROLES.SISWA).maybeSingle();
  if (studentError) return { error: "Akun siswa belum dapat diperiksa. Silakan coba lagi." };
  if (!student) return { error: "Akun siswa tidak ditemukan." };

  const { email, password } = parsed.data;
  const emailChanged = email !== originalEmail;
  if (!emailChanged && !password) return { ok: true };
  const admin = createAdminClient();
  if (emailChanged) {
    const current = await admin.auth.admin.getUserById(student.id);
    if (current.error || !current.data.user) return { error: "Email siswa belum dapat diperiksa. Silakan coba lagi." };
    const currentEmail = current.data.user.email ?? "";
    if (currentEmail !== originalEmail && currentEmail !== email) {
      return { error: "Email siswa sudah berubah. Muat ulang halaman sebelum menyimpan." };
    }
  }
  const { data, error } = await admin.auth.admin.updateUserById(student.id, {
    ...(emailChanged ? { email, email_confirm: true } : {}),
    ...(password ? { password } : {}),
  });
  if (error?.code === "email_exists" || error?.code === "user_already_exists" || (error && /email.*already/i.test(error.message))) {
    return { error: "Email sudah terdaftar." };
  }
  if (error?.code === "weak_password") return { error: "Password baru tidak memenuhi ketentuan keamanan. Gunakan password lain." };
  if (error?.code === "same_password") return { error: "Gunakan password yang berbeda dari password saat ini." };
  if (error || !data.user) return { error: "Akun login gagal diperbarui. Silakan coba lagi." };

  revalidatePath(ADMIN_STUDENTS_PATH);
  revalidatePath(`${ADMIN_STUDENTS_PATH}/${id}/edit`);
  return { ok: true };
}

export async function createStudent(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await isAdmin())) return { error: "Hanya admin." };

  const parsed = studentSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    class_id: formData.get("class_id") || undefined,
    nis: formData.get("nis") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name, role: "siswa" },
  });
  if (error) {
    return {
      error: /already|registered|exists/i.test(error.message)
        ? "Email sudah terdaftar."
        : error.message,
    };
  }
  if (!data.user) return { error: "Gagal membuat akun." };

  await admin
    .from("profiles")
    .update({
      class_id: parsed.data.class_id || null,
      nis: parsed.data.nis || null,
    })
    .eq("id", data.user.id);

  revalidatePath(ADMIN_STUDENTS_PATH);
  return { ok: true };
}

export async function deleteStudent(id: string) {
  if (!(await isAdmin())) return;
  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(id);
  revalidatePath(ADMIN_STUDENTS_PATH);
}

export async function importStudents(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  if (!(await isAdmin())) return { error: "Hanya admin." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pilih file .xlsx atau .csv terlebih dahulu." };
  }
  if (file.size > 5 * 1024 * 1024) return { error: "Ukuran file maksimal 5MB." };

  let rows: Record<string, string>[];
  try {
    rows = await parseSheet(file);
  } catch (e) {
    return {
      error:
        "Gagal membaca file: " +
        (e instanceof Error ? e.message : "format tidak dikenali"),
    };
  }

  if (rows.length === 0) {
    return {
      error:
        "Tidak ada baris data. Baris pertama harus header: nama, email, kelas, nis, password.",
    };
  }
  if (rows.length > 300) return { error: "Maksimal 300 baris per impor." };

  const admin = createAdminClient();
  const { data: classes } = await admin.from("classes").select("id, name");
  // Kunci dinormalisasi sama seperti unique index DB (migrasi 0012):
  // huruf kecil + spasi dirapikan, agar "XI  rpl 1" cocok dengan "XI RPL 1".
  const normClass = (s: string) => s.replace(/s+/g, " ").trim().toLowerCase();
  const classByName = new Map(
    (classes ?? []).map((c) => [normClass(c.name), c.id] as const),
  );

  let created = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nama = pickField(row, ["nama", "name", "full_name", "nama lengkap"]);
    const email = pickField(row, ["email", "e-mail"]);
    const kelas = pickField(row, ["kelas", "class"]);
    const nis = pickField(row, ["nis", "no induk", "nomor induk"]);
    const password =
      pickField(row, ["password", "kata sandi"]) || nis || "sipensi123";
    const line = i + 2;

    if (!nama || !email) {
      errors.push(`Baris ${line}: nama/email kosong.`);
      continue;
    }
    if (password.length < 6) {
      errors.push(`Baris ${line}: password < 6 karakter.`);
      continue;
    }

    let classId: string | null = null;
    if (kelas) {
      const key = normClass(kelas);
      classId = classByName.get(key) ?? null;
      if (!classId) {
        const { data: nc } = await admin
          .from("classes")
          .insert({ name: kelas.replace(/s+/g, " ").trim() })
          .select("id")
          .maybeSingle();
        if (nc) {
          classId = nc.id;
          classByName.set(key, nc.id);
        }
      }
      // Jangan buat siswa tanpa kelas diam-diam — izinnya tak akan terarah.
      if (!classId) {
        errors.push(`Baris ${line}: kelas "${kelas}" gagal dibuat/ditemukan.`);
        continue;
      }
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: nama, role: "siswa" },
    });
    if (error) {
      errors.push(
        `Baris ${line} (${email}): ${
          /already|registered|exists/i.test(error.message)
            ? "email sudah terdaftar"
            : error.message
        }`,
      );
      continue;
    }
    if (!data.user) {
      errors.push(`Baris ${line}: gagal membuat akun.`);
      continue;
    }
    await admin
      .from("profiles")
      .update({ class_id: classId, nis: nis || null })
      .eq("id", data.user.id);
    created++;
  }

  revalidatePath(ADMIN_STUDENTS_PATH);
  return { ok: true, created, failed: errors.length, errors: errors.slice(0, 12) };
}
