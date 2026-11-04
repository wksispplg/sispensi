import "server-only";

import { createClient } from "@/lib/supabase/server";
import { APPROVER_ROLES, REQUEST_STATUS, ROLES } from "@/lib/constants";
import type { Profile } from "@/types";
import { todayWibStart, type ApprovalItem, type DecisionItem } from "./presentation";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Filter penugasan sama untuk daftar, statistik, dan beranda. RLS tetap berlaku. */
export function pendingApprovalsQuery(client: Client, profile: Profile) {
  let query = client.from("permission_requests")
    .select("id, izin_type, reason, current_layer, requested_at, requested_until, created_at, current_deadline, evidence_url, student_id, class_id, lesson_period_start, lesson_period_end")
    .eq("status", REQUEST_STATUS.PENDING);
  if (profile.role === ROLES.SISWA) return query.eq("student_id", profile.id).eq("current_approver_id", profile.id);
  if (profile.role === ROLES.GURU_BK) query = query.or(`current_approver_id.eq.${profile.id},current_layer.eq.3`);
  else if (profile.role !== ROLES.ADMIN) query = query.eq("current_approver_id", profile.id);
  return query;
}

async function identityMaps(client: Client, rows: { student_id: string; class_id: string | null }[]) {
  const ids = [...new Set(rows.map((row) => row.student_id))];
  const classes = [...new Set(rows.flatMap((row) => row.class_id ? [row.class_id] : []))];
  const [studentsResult, classesResult] = await Promise.all([
    ids.length ? client.from("profiles").select("id, full_name").in("id", ids) : Promise.resolve({ data: [], error: null }),
    classes.length ? client.from("classes").select("id, name").in("id", classes) : Promise.resolve({ data: [], error: null }),
  ]);
  return {
    students: new Map((studentsResult.data ?? []).map((row) => [row.id, row.full_name ?? "Siswa"])),
    classes: new Map((classesResult.data ?? []).map((row) => [row.id, row.name])),
    failed: !!studentsResult.error || !!classesResult.error,
  };
}

export async function getPendingApprovals(profile: Profile, limit?: number) {
  const client = await createClient();
  let query = pendingApprovalsQuery(client, profile).order("current_deadline", { ascending: true, nullsFirst: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  const rows = data ?? [];
  const maps = await identityMaps(client, rows);
  const items: ApprovalItem[] = rows.map((row) => ({
    id: row.id, studentName: maps.students.get(row.student_id) ?? "Siswa", className: row.class_id ? maps.classes.get(row.class_id) ?? null : null,
    reason: row.reason, izinType: row.izin_type, createdAt: row.created_at, requestedAt: row.requested_at, requestedUntil: row.requested_until,
    lessonPeriodStart: row.lesson_period_start, lessonPeriodEnd: row.lesson_period_end, currentLayer: row.current_layer,
    deadline: row.current_deadline, hasEvidence: !!row.evidence_url,
  }));
  return { items, failed: !!error || maps.failed, now: Date.now() };
}

async function decisionStatistics(client: Client, id: string) {
  const queries = ([undefined, REQUEST_STATUS.APPROVED, REQUEST_STATUS.REJECTED, "today"] as const).map((status) => {
    let query = client.from("permission_requests").select("id", { count: "exact", head: true }).eq("decided_by", id);
    if (status === "today") query = query.eq("status", REQUEST_STATUS.APPROVED).gte("decided_at", todayWibStart());
    else if (status) query = query.eq("status", status);
    return query;
  });
  const [total, approved, rejected, today] = await Promise.all(queries);
  return { statistics: { total: total.count ?? 0, approved: approved.count ?? 0, rejected: rejected.count ?? 0, approvedToday: today.count ?? 0 }, failed: [total, approved, rejected, today].some((result) => !!result.error) };
}

export async function getDecisionHistory(profile: Profile, limit?: number) {
  const client = await createClient();
  let query = client.from("permission_requests")
    .select("id, reason, izin_type, status, decided_at, student_id, class_id")
    .eq("decided_by", profile.id).order("decided_at", { ascending: false });
  if (limit) query = query.limit(limit);
  const [result, counts] = await Promise.all([query, decisionStatistics(client, profile.id)]);
  const rows = result.data ?? [];
  const maps = await identityMaps(client, rows);
  const items: DecisionItem[] = rows.map((row) => ({ id: row.id, studentName: maps.students.get(row.student_id) ?? "Siswa", className: row.class_id ? maps.classes.get(row.class_id) ?? null : null, reason: row.reason, izinType: row.izin_type, status: row.status, decidedAt: row.decided_at }));
  return { items, statistics: counts.statistics, failed: !!result.error || counts.failed || maps.failed, now: Date.now() };
}

export async function getStaffDashboard(profile: Profile) {
  const client = await createClient();
  if (profile.role === ROLES.ADMIN) {
    const counts = await Promise.all([
      client.from("profiles").select("id", { count: "exact", head: true }).eq("role", ROLES.SISWA),
      client.from("profiles").select("id", { count: "exact", head: true }).in("role", [...APPROVER_ROLES]),
      client.from("classes").select("id", { count: "exact", head: true }),
      client.from("schedules").select("id", { count: "exact", head: true }),
    ]);
    return {
      pending: [] as ApprovalItem[], recentDecisions: [] as DecisionItem[],
      statistics: { total: 0, approved: 0, rejected: 0, approvedToday: 0 }, pendingCount: 0,
      school: { students: counts[0].count ?? 0, teachers: counts[1].count ?? 0, classes: counts[2].count ?? 0, schedules: counts[3].count ?? 0 },
      layer3Count: 0, failed: counts.some((result) => !!result.error), now: Date.now(),
    };
  }
  let pendingCountQuery = client.from("permission_requests").select("id", { count: "exact", head: true }).eq("status", REQUEST_STATUS.PENDING);
  if (profile.role === ROLES.GURU_BK) pendingCountQuery = pendingCountQuery.or(`current_approver_id.eq.${profile.id},current_layer.eq.3`);
  else pendingCountQuery = pendingCountQuery.eq("current_approver_id", profile.id);
  const [pending, history, pendingCount, extra] = await Promise.all([
    getPendingApprovals(profile, 3), getDecisionHistory(profile, 2), pendingCountQuery,
    profile.role === ROLES.GURU_BK ? Promise.all([
      client.from("permission_requests").select("id", { count: "exact", head: true }).eq("status", REQUEST_STATUS.PENDING).eq("current_layer", 3),
    ]) : Promise.resolve([]),
  ]);
  return {
    pending: pending.items, recentDecisions: history.items, statistics: history.statistics, pendingCount: pendingCount.count ?? 0,
    school: null,
    layer3Count: profile.role === ROLES.GURU_BK ? extra[0]?.count ?? 0 : 0,
    failed: pending.failed || history.failed || !!pendingCount.error || extra.some((result) => !!result.error),
    now: Date.now(),
  };
}
