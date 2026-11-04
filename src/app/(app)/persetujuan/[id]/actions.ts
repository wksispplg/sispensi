"use server";

import { redirect } from "next/navigation";
import { saveDecision, type DecisionState } from "@/features/approvals/actions";

export type DecideState = DecisionState;

export async function decideRequest(previous: DecideState, formData: FormData): Promise<DecideState> {
  const result = await saveDecision(previous, formData);
  if (result.error) return result;
  redirect("/persetujuan?done=1");
}
