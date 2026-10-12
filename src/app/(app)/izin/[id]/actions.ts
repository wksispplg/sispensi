"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function cancelRequestAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_request", { p_request: id });

  if (error) {
    redirect(`/izin/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/izin");
  revalidatePath(`/izin/${id}`);
  redirect("/izin?cancelled=1");
}
