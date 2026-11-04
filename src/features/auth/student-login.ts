import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { ROLES } from "@/lib/constants";

/** Resolusi NIS hanya di server; email akun tidak dikirim ke formulir/browser. */
export async function studentLoginEmail(nis: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: profile, error } = await admin.from("profiles")
    .select("id").eq("nis", nis).eq("role", ROLES.SISWA).maybeSingle();
  if (error) throw new Error("Pencarian akun siswa belum tersedia.");
  if (!profile) return null;

  const { data, error: userError } = await admin.auth.admin.getUserById(profile.id);
  if (userError) throw new Error("Pencarian akun siswa belum tersedia.");
  return data.user?.email ?? null;
}
