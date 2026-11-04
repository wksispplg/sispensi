import Link from "next/link";
import { ArrowUpRight, Clock3 } from "lucide-react";

import { APPROVAL_HISTORY_PATH, APPROVALS_PATH, REKAP_PATH, ROLE_LABELS, ROLES } from "@/lib/constants";
import type { Profile } from "@/types";
import type { getStaffDashboard } from "@/features/approvals/data";
import { ApprovalList } from "@/features/approvals/approval-list";
import { StaffEmpty, StaffError, StaffStat } from "@/features/approvals/staff-widgets";
import { staffDate } from "@/features/approvals/presentation";
import { requestTitle, StudentStatus } from "@/features/izin/student-view";
import { AdminDashboard } from "./admin-dashboard";

export function StaffDashboard({ profile, data }: { profile: Profile; data: Awaited<ReturnType<typeof getStaffDashboard>> }) {
  if (profile.role === ROLES.ADMIN) return <AdminDashboard profile={profile} school={data.school} failed={data.failed} />;
  const bk = profile.role === ROLES.GURU_BK;
  return <div className="flex flex-col gap-7 lg:gap-12">
    <section className="flex min-w-0 flex-col justify-center gap-5 rounded-[24px] bg-[#343b41] px-6 py-6 text-white sm:flex-row sm:items-center sm:justify-between lg:min-h-36 lg:px-8">
      <div className="min-w-0"><p className="mb-1 text-xs text-[#b9c1c8] lg:text-sm">Halo, {ROLE_LABELS[profile.role]}</p><h2 className="text-2xl leading-tight font-semibold wrap-anywhere lg:text-[32px]">{profile.full_name?.trim() || ROLE_LABELS[profile.role]}</h2></div>
      <Link href={APPROVALS_PATH} className="app-button staff-primary-action w-fit shrink-0 px-6 py-3">Tinjau Pengajuan</Link>
    </section>
    {data.failed ? <StaffError /> : <>
      <section aria-label="Ringkasan akun" className={`grid grid-cols-2 gap-3 lg:mt-4 lg:gap-4 ${bk ? "xl:grid-cols-4" : "lg:grid-cols-3"}`}>
          <StaffStat label="Perlu Persetujuan" value={data.pendingCount} tone="red" />
          <StaffStat label="Disetujui Hari Ini" value={data.statistics.approvedToday} tone="green" />
          <StaffStat label="Total Diputuskan" value={data.statistics.total} />
          {bk ? <StaffStat label="Eskalasi Lapis 3" value={data.layer3Count} tone="red" /> : null}
      </section>
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,2.45fr)_minmax(235px,1fr)]">
        <section className="app-panel px-5 py-5 sm:px-7">
          <div className="mb-4 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm font-medium lg:text-base">Perlu Persetujuan <Clock3 className="size-4" strokeWidth={1.5} aria-hidden /></h3><Link href={APPROVALS_PATH} className="flex min-h-9 items-center text-xs whitespace-nowrap text-red-600 underline underline-offset-2">Lihat semua</Link></div>
          {data.pending.length ? <ApprovalList requests={data.pending} now={data.now} compact /> : <StaffEmpty title="Semua pengajuan sudah ditinjau" description="Pengajuan yang perlu keputusan Anda akan muncul di sini." />}
        </section>
        <aside className="flex min-w-0 flex-col gap-5">
          <section className="app-panel p-6"><h3 className="mb-4 flex items-center gap-2 text-sm font-medium">Keputusan Terbaru <Clock3 className="size-4" strokeWidth={1.5} aria-hidden /></h3>
            {data.recentDecisions.length ? <ul className="divide-y divide-zinc-100">{data.recentDecisions.map((item) => <li key={item.id} className="py-3"><Link href={`/persetujuan/${item.id}`} className="block truncate text-xs font-medium hover:text-red-600">{item.studentName}</Link><p className="mt-1 truncate text-[11px] text-[#747983]">{requestTitle(item.reason)}</p><div className="mt-2 flex flex-wrap items-center gap-2"><StudentStatus status={item.status} />{item.decidedAt ? <span className="text-[10px] text-[#747983]">{staffDate.format(new Date(item.decidedAt))}</span> : null}</div></li>)}</ul> : <StaffEmpty title="Belum ada keputusan" />}
            <Link href={APPROVAL_HISTORY_PATH} className="mt-3 inline-flex min-h-9 items-center text-xs text-red-600 underline underline-offset-2">Lihat riwayat keputusan</Link>
          </section>
          {bk ? <Link href={REKAP_PATH} className="app-panel flex min-h-20 items-center justify-between gap-3 p-6 text-sm font-medium hover:text-red-600">Rekap Perizinan <ArrowUpRight className="size-4" aria-hidden /></Link> : null}
        </aside>
      </div>
    </>}
    <p className="px-6 text-xs leading-relaxed text-[#747983] lg:-mt-5">*Catatan: Periksa notifikasi pengajuan izin siswa agar pengajuan dapat segera diproses.</p>
  </div>;
}
