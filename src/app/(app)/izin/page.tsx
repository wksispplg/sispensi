import { requireRole } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { getStudentRequests } from "@/features/izin/student-data";
import { RequestHistory } from "./request-history";

export default async function RiwayatIzinPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const profile = await requireRole(ROLES.SISWA);
  const [{ ok }, { data, error }] = await Promise.all([searchParams, getStudentRequests(profile.id)]);
  return <div className="flex flex-col gap-5 pt-2 lg:pt-3">
    {ok === "1" ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-800">Pengajuan berhasil dikirim. Status akan diperbarui setelah diproses.</p> : null}
    {error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Riwayat belum dapat dimuat. Silakan muat ulang halaman.</p> : <RequestHistory requests={data ?? []} />}
  </div>;
}
