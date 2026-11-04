"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { APPROVAL_ACTIONS, ROLES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export type DecisionState = { error?: string; ok?: boolean };

export async function saveDecision(_previous: DecisionState, formData: FormData): Promise<DecisionState> {
  const profile = await getProfile();
  if (!profile || profile.role === ROLES.SISWA) return { error: "Anda tidak berwenang memutuskan pengajuan." };
  const parsed = z.object({ id: z.uuid(), action: z.enum([APPROVAL_ACTIONS.APPROVED, APPROVAL_ACTIONS.REJECTED]), note: z.string().trim().max(1000, "Catatan maksimal 1000 karakter.") }).safeParse({ id: formData.get("id"), action: formData.get("_action"), note: formData.get("note") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Permintaan tidak valid." };
  const { id, action, note } = parsed.data;
  if (action === APPROVAL_ACTIONS.REJECTED && !note) return { error: "Penolakan wajib menyertakan alasan." };
  const client = await createClient();
  // RPC memeriksa ulang penugasan dan status secara atomik, termasuk bila guru lain sudah memprosesnya.
  const { error } = await client.rpc("decide_request", { p_request: id, p_action: action, p_note: note || undefined });
  if (error) return { error: error.message };
  // Kabar pengajuan yang sudah ditangani ditandai dibaca hanya pada akun pemutus.
  try {
    await client.from("notifications").update({ is_read: true }).eq("user_id", profile.id).eq("request_id", id);
  } catch {
    // Keputusan yang sudah tersimpan tetap berhasil walau penanda notifikasi gagal.
  }
  for (const path of ["/dashboard", "/persetujuan", `/persetujuan/${id}`, "/riwayat-keputusan", "/izin", `/izin/${id}`, "/surat-digital", "/notifikasi", "/rekap"]) revalidatePath(path);
  return { ok: true };
}
