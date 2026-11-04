"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { DASHBOARD_PATH, LOGIN_PATH } from "@/lib/constants";
import { studentLoginEmail } from "@/features/auth/student-login";

/**
 * Tujuan setelah login: hanya path internal (diawali satu "/") agar tidak bisa
 * dipakai untuk open redirect ke situs lain. Selain itu → dashboard.
 */
function safeRedirectPath(raw: FormDataEntryValue | null): string {
  const path = typeof raw === "string" ? raw.trim() : "";
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) {
    return DASHBOARD_PATH;
  }
  if (path.startsWith(LOGIN_PATH) || path.startsWith("/auth")) {
    return DASHBOARD_PATH;
  }
  return path;
}

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "NIS atau email wajib diisi").max(254)
    .refine((value) => z.email().safeParse(value).success || /^[^\s@]{1,30}$/.test(value), "Masukkan NIS atau email yang valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export type LoginState = {
  error?: string;
  /** Hanya isian pengguna; email hasil pencarian NIS dan password tidak dikembalikan. */
  identifier?: string;
};

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const identifier = typeof formData.get("identifier") === "string" ? (formData.get("identifier") as string).trim() : "";
  const parsed = loginSchema.safeParse({
    identifier,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Input tidak valid",
      identifier,
    };
  }

  try {
    const email = parsed.data.identifier.includes("@")
      ? parsed.data.identifier.toLowerCase()
      : await studentLoginEmail(parsed.data.identifier);
    if (!email) return { error: "NIS/email atau password salah.", identifier };

    // Tetap verifikasi password dan buat cookie sesi melalui Supabase Auth biasa.
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
    if (error) return { error: "NIS/email atau password salah.", identifier };
  } catch {
    return { error: "Login belum dapat diproses. Silakan coba lagi.", identifier };
  }

  // Sukses: redirect() melempar internal, jadi harus di luar blok try/catch.
  redirect(safeRedirectPath(formData.get("next")));
}
