"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { DASHBOARD_PATH, LOGIN_PATH } from "@/lib/constants";

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
  email: z.email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export type LoginState = {
  error?: string;
  /** Email yang diketik, dikembalikan agar field tidak kosong setelah gagal. */
  email?: string;
};

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const parsed = loginSchema.safeParse({
    email,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Input tidak valid",
      email,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Email atau password salah.", email };
  }

  // Sukses: redirect() melempar internal, jadi harus di luar blok try/catch.
  redirect(safeRedirectPath(formData.get("next")));
}
