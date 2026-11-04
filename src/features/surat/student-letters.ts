import type { IzinType } from "@/lib/constants";

export type StudentLetter = {
  id: string;
  request_id: string;
  letter_number: string | null;
  issued_at: string;
  qr_token: string;
  permission_requests: {
    reason: string;
    izin_type: IzinType;
    requested_at: string;
    requested_until: string | null;
  };
};

const wibDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Jakarta" });

/** Selesai berarti waktu di surat sudah lewat, bukan pemantauan kehadiran. */
export function studentLetterState(letter: StudentLetter, now: number): "active" | "scheduled" | "finished" {
  const request = letter.permission_requests;
  if (request.requested_until ? new Date(request.requested_until).getTime() < now : wibDay.format(new Date(request.requested_at)) < wibDay.format(new Date(now))) return "finished";
  if (new Date(request.requested_at).getTime() > now) return "scheduled";
  return "active";
}
