import "server-only";

import { createClient } from "@/lib/supabase/server";
import { REQUEST_STATUS } from "@/lib/constants";

export async function getStudentRequests(studentId: string) {
  const supabase = await createClient();
  return supabase.from("permission_requests")
    .select("id, reason, izin_type, status, created_at, requested_at, requested_until, lesson_period_start, lesson_period_end")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
}

export async function getStudentDashboard(studentId: string) {
  const supabase = await createClient();
  const counts = [undefined, REQUEST_STATUS.PENDING, REQUEST_STATUS.APPROVED, REQUEST_STATUS.REJECTED].map((status) => {
    const query = supabase.from("permission_requests").select("id", { count: "exact", head: true }).eq("student_id", studentId);
    return status ? query.eq("status", status) : query;
  });
  const [countResults, recent] = await Promise.all([
    Promise.all(counts),
    supabase.from("permission_requests")
      .select("id, reason, izin_type, status, created_at, requested_at, requested_until, lesson_period_start, lesson_period_end")
      .eq("student_id", studentId).order("created_at", { ascending: false }).limit(3),
  ]);
  const [total, pending, approved, rejected] = countResults;
  return {
    requests: recent.data ?? [],
    statistics: { total: total.count ?? 0, pending: pending.count ?? 0, approved: approved.count ?? 0, rejected: rejected.count ?? 0 },
    failed: [total, pending, approved, rejected, recent].some((result) => !!result.error),
  };
}
