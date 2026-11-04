import type { IzinType, RequestStatus } from "@/lib/constants";

export type ApprovalItem = {
  id: string;
  studentName: string;
  className: string | null;
  reason: string;
  izinType: IzinType;
  createdAt: string;
  requestedAt: string;
  requestedUntil: string | null;
  lessonPeriodStart: number | null;
  lessonPeriodEnd: number | null;
  currentLayer: number;
  deadline: string | null;
  hasEvidence: boolean;
};

export type DecisionItem = {
  id: string;
  studentName: string;
  className: string | null;
  reason: string;
  izinType: IzinType;
  status: RequestStatus;
  decidedAt: string | null;
};

export type DecisionStatistics = { total: number; approved: number; rejected: number; approvedToday: number };

export const staffDate = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
export const staffDateTime = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export function relativeRequestTime(value: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(value)) / 60000));
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} jam lalu`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)} hari lalu`;
  return staffDate.format(new Date(value));
}

export function todayWibStart(now = new Date()): string {
  const date = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Jakarta" }).format(now);
  return new Date(`${date}T00:00:00+07:00`).toISOString();
}
