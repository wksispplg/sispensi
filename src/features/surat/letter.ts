import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { REQUEST_STATUS, STORAGE_BUCKETS } from "@/lib/constants";
import { generateLetterPdf } from "./pdf";
import { getLetterNumber } from "./qr";

/** Dipanggil setelah akses surat diperiksa dengan RLS oleh route unduhan. */
export async function ensureLetterPdf(token: string, verifyUrl: string): Promise<{ bytes: Uint8Array; filename: string } | null> {
  const admin = createAdminClient();
  const { data: letter, error: letterError } = await admin.from("digital_letters")
    .select("id, request_id, letter_number, issued_at").eq("qr_token", token).maybeSingle();
  if (letterError) throw new Error("Data surat belum dapat dibaca.");
  if (!letter) return null;

  const { data: request, error: requestError } = await admin.from("permission_requests")
    .select("student_id, class_id, izin_type, reason, requested_at, requested_until, lesson_period_start, lesson_period_end, status, decided_by, decided_at")
    .eq("id", letter.request_id).maybeSingle();
  if (requestError) throw new Error("Data pengajuan belum dapat dibaca.");
  if (!request || request.status !== REQUEST_STATUS.APPROVED || !request.decided_at) return null;

  const [studentResult, classResult, approverResult] = await Promise.all([
    admin.from("profiles").select("full_name, nis").eq("id", request.student_id).maybeSingle(),
    request.class_id ? admin.from("classes").select("name").eq("id", request.class_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    request.decided_by ? admin.from("profiles").select("full_name, role").eq("id", request.decided_by).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (studentResult.error || classResult.error || approverResult.error) throw new Error("Identitas pada surat belum dapat dibaca.");
  const studentName = studentResult.data?.full_name?.trim();
  if (!studentName) throw new Error("Nama siswa belum tersedia.");
  const letterNumber = getLetterNumber(letter.letter_number, letter.issued_at, token);

  // Selalu buat ulang: file kosong/lama dan QR domain lama di Storage tidak
  // boleh menjadi sumber unduhan berikutnya.
  const bytes = await generateLetterPdf({
    letterNumber,
    studentName,
    nis: studentResult.data?.nis ?? "",
    className: classResult.data?.name ?? "-",
    izinType: request.izin_type,
    reason: request.reason,
    requestedAt: request.requested_at,
    requestedUntil: request.requested_until,
    lessonPeriodStart: request.lesson_period_start,
    lessonPeriodEnd: request.lesson_period_end,
    issuedAt: letter.issued_at,
    decidedAt: request.decided_at,
    approverName: approverResult.data?.full_name ?? "Guru penanggung jawab",
    approverRole: approverResult.data?.role ?? null,
  }, verifyUrl);

  const storagePath = `${request.student_id}/${letter.request_id}.pdf`;
  try {
    const { error: uploadError } = await admin.storage.from(STORAGE_BUCKETS.LETTERS)
      .upload(storagePath, bytes, { contentType: "application/pdf", upsert: true });
    const { error } = await admin.from("digital_letters")
      .update({ letter_number: letterNumber, ...(!uploadError ? { pdf_url: storagePath } : {}) }).eq("id", letter.id);
    if (uploadError || error) console.warn("[surat] Salinan PDF belum dapat disimpan atau dicatat di Storage.");
  } catch {
    // Kegagalan salinan tidak membuang PDF yang sudah berhasil dibuat.
    console.warn("[surat] Salinan PDF belum dapat disimpan di Storage.");
  }
  return { bytes, filename: `Surat-Izin-${letterNumber.replace(/[^\w-]/g, "_")}.pdf` };
}
