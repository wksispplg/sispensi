import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { DASHBOARD_PATH, ROLES } from "@/lib/constants";
import { getPendingApprovals } from "@/features/approvals/data";
import { ApprovalList } from "@/features/approvals/approval-list";
import { StaffEmpty, StaffError } from "@/features/approvals/staff-widgets";

export default async function PersetujuanPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const profile = await getProfile();
  if (!profile) return null;
  if (profile.role === ROLES.SISWA) redirect(DASHBOARD_PATH);
  const [{ done }, data] = await Promise.all([searchParams, getPendingApprovals(profile)]);
  return <div className="space-y-6 pt-2 lg:pt-4">
    {done === "1" ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Keputusan tersimpan.</p> : null}
    {data.failed ? <StaffError /> : <section aria-label="Pengajuan yang perlu persetujuan" className="app-panel px-5 py-3 sm:px-7 lg:px-8 lg:py-5">
      {data.items.length ? <ApprovalList requests={data.items} now={data.now} /> : <StaffEmpty title="Tidak ada pengajuan yang menunggu" description="Pengajuan yang ditugaskan kepada Anda akan ditampilkan di sini." />}
    </section>}
    <p className="px-4 text-xs leading-relaxed text-[#747983]">*Catatan: Periksa notifikasi pengajuan izin siswa agar pengajuan dapat segera diproses.</p>
  </div>;
}
