import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { LETTER_TOKEN_PATTERN, getLetterNumber } from "./qr";
import type { LetterVerification } from "./verification";

/** Data minimum verifikasi QR publik; jangan tambahkan alasan, NIS, atau bukti. */
export async function readLetterVerification(token: string): Promise<LetterVerification | null> {
  if (!LETTER_TOKEN_PATTERN.test(token)) return null;
  const admin = createAdminClient();
  const { data: letter, error } = await admin.from("digital_letters")
    .select("request_id, letter_number, issued_at").eq("qr_token", token).maybeSingle();
  if (error) throw new Error("Verifikasi belum tersedia.");
  if (!letter) return null;
  const { data: request, error: requestError } = await admin.from("permission_requests")
    .select("student_id, class_id, izin_type, status, requested_at, requested_until, lesson_period_start, lesson_period_end, decided_at")
    .eq("id", letter.request_id).maybeSingle();
  if (requestError) throw new Error("Verifikasi belum tersedia.");
  if (!request) return null;
  const [student, schoolClass] = await Promise.all([
    admin.from("profiles").select("full_name").eq("id", request.student_id).maybeSingle(),
    request.class_id ? admin.from("classes").select("name").eq("id", request.class_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (student.error || schoolClass.error) throw new Error("Verifikasi belum tersedia.");
  return {
    letterNumber: getLetterNumber(letter.letter_number, letter.issued_at, token),
    studentName: student.data?.full_name ?? "Siswa",
    className: schoolClass.data?.name ?? "-",
    izinType: request.izin_type,
    status: request.status,
    requestedAt: request.requested_at,
    issuedAt: letter.issued_at,
    decidedAt: request.decided_at,
    requestedUntil: request.requested_until,
    lessonPeriodStart: request.lesson_period_start,
    lessonPeriodEnd: request.lesson_period_end,
  };
}
