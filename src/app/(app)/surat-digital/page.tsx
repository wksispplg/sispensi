import { requireRole } from "@/lib/auth";
import { ROLES, REQUEST_STATUS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { DigitalLetters } from "./digital-letters";

export default async function DigitalLettersPage({ searchParams }: { searchParams: Promise<{ pengajuan?: string }> }) {
  const profile = await requireRole(ROLES.SISWA);
  const supabase = await createClient();
  const [{ data, error }, params] = await Promise.all([
    supabase.from("digital_letters")
      .select("id, request_id, letter_number, issued_at, qr_token, permission_requests!inner(reason, izin_type, requested_at, requested_until)")
      .eq("permission_requests.student_id", profile.id)
      .eq("permission_requests.status", REQUEST_STATUS.APPROVED)
      .order("issued_at", { ascending: false }),
    searchParams,
  ]);
  if (error) return <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Surat izin belum dapat dimuat. Silakan muat ulang halaman.</p>;
  // Snapshot waktu di Server Component ini dikirim bersama data, agar render server/client konsisten.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  return <DigitalLetters key={params.pengajuan ?? "all"} letters={data ?? []} initialRequestId={params.pengajuan} now={now} />;
}
