"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { DASHBOARD_PATH, PEMANTAUAN_PATH } from "@/lib/constants";

export type DispenActionState = { error?: string; ok?: boolean };

/** Siswa menekan "Mulai Dispen" (setelah izin disetujui). */
export async function startDispenAction(
  id: string,
): Promise<DispenActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_dispen", { p_request: id });
  if (error) return { error: error.message };
  revalidatePath(DASHBOARD_PATH);
  revalidatePath("/izin");
  revalidatePath(`/izin/${id}`);
  return { ok: true };
}

/** Siswa menekan "Kembali ke Sekolah". */
export async function returnDispenAction(
  id: string,
): Promise<DispenActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("return_dispen", { p_request: id });
  if (error) return { error: error.message };
  revalidatePath(DASHBOARD_PATH);
  revalidatePath("/izin");
  revalidatePath(`/izin/${id}`);
  revalidatePath(PEMANTAUAN_PATH);
  return { ok: true };
}
