"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { ROLES, NOTIFICATIONS_PATH } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export async function readNotifications(id?: string): Promise<{ error?: string }> {
  const profile = await requireRole(ROLES.SISWA);
  if (id !== undefined && !z.uuid().safeParse(id).success) return { error: "Notifikasi tidak valid." };
  const supabase = await createClient();
  let query = supabase.from("notifications").update({ is_read: true })
    .eq("user_id", profile.id).eq("is_read", false);
  if (id) query = query.eq("id", id);
  const { error } = await query;
  if (error) return { error: "Notifikasi belum dapat ditandai dibaca. Silakan coba lagi." };
  revalidatePath(NOTIFICATIONS_PATH);
  return {};
}
