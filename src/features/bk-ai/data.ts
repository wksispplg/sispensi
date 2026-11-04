import "server-only";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { DAY_LABELS, IZIN_TYPE_LABELS, ROLES, type IzinType } from "@/lib/constants";
import { ANALYSIS_MAX_ITEMS, type AnalysisPatterns } from "./contract";

type HistoryRow = {
  izin_type: string; status: string; reason: string; created_at: string; updated_at: string;
  requested_at: string; lesson_period_start: number | null; lesson_period_end: number | null;
};

export class AnalysisDataError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

/** Dipanggil setelah otorisasi BK. Tetap memakai client sesi dan RLS. */
export async function loadStudentPatterns(studentId: string, now = Date.now()) {
  const client = await createClient();
  const { data: student, error: studentError } = await client.from("profiles")
    .select("id").eq("id", studentId).eq("role", ROLES.SISWA).maybeSingle();
  if (studentError) throw new AnalysisDataError(503, "Data siswa belum dapat dimuat. Silakan coba lagi.");
  if (!student) throw new AnalysisDataError(404, "Siswa tidak ditemukan.");

  const { data, count, error } = await client.from("permission_requests")
    .select("izin_type, status, reason, created_at, updated_at, requested_at, lesson_period_start, lesson_period_end", { count: "exact" })
    .eq("student_id", studentId).order("created_at", { ascending: false }).limit(ANALYSIS_MAX_ITEMS);
  if (error || count === null) throw new AnalysisDataError(503, "Riwayat izin belum dapat dimuat. Silakan coba lagi.");
  const rows: HistoryRow[] = data ?? [];
  const patterns = aggregatePatterns(rows, count, now);
  // Semua baris sampel ikut fingerprint, termasuk perubahan pada pengajuan lama.
  const fingerprint = createHash("sha256").update(JSON.stringify({ patterns, rows })).digest("hex");
  return { patterns, fingerprint };
}

/** Data teks/identitas hanya diolah lokal; penyedia AI menerima hitungan agregat. */
export function aggregatePatterns(rows: HistoryRow[], total: number, now: number): AnalysisPatterns {
  const patterns: AnalysisPatterns = { total, analyzed: rows.length, from: null, to: null, recent30Days: 0, byType: {}, byStatus: {}, byWeekday: {}, byLessonPeriod: {}, repeatedReasonCounts: [] };
  const reasons = new Map<string, number>();
  const days: string[] = [];
  const add = (counts: Record<string, number>, key: string) => { counts[key] = (counts[key] ?? 0) + 1; };
  for (const row of rows) {
    add(patterns.byType, IZIN_TYPE_LABELS[row.izin_type as IzinType] ?? "Lainnya");
    add(patterns.byStatus, row.status);
    const at = Date.parse(row.requested_at || row.created_at);
    if (Number.isFinite(at)) {
      const wib = new Date(at + 7 * 3600_000);
      days.push(wib.toISOString().slice(0, 10));
      add(patterns.byWeekday, DAY_LABELS[wib.getUTCDay() || 7]);
      if (row.status !== "cancelled" && at <= now && at >= now - 30 * 86400_000) patterns.recent30Days++;
    }
    if (row.lesson_period_start !== null) add(patterns.byLessonPeriod, String(row.lesson_period_start));
    const reason = row.reason.trim().replace(/\s+/g, " ").toLowerCase();
    if (reason) reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  }
  days.sort();
  patterns.from = days[0] ?? null;
  patterns.to = days.at(-1) ?? null;
  patterns.repeatedReasonCounts = [...reasons.values()].filter((value) => value > 1).sort((a, b) => b - a);
  return patterns;
}
