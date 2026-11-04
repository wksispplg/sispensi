import Link from "next/link";
import { ArrowUpRight, BookUser, Clock3, GraduationCap, Users } from "lucide-react";

import { ADMIN_CLASSES_PATH, ADMIN_STUDENTS_PATH, ADMIN_TEACHERS_PATH, APPROVAL_HISTORY_PATH, APPROVALS_PATH, REKAP_PATH, ROLE_LABELS, ROLES } from "@/lib/constants";
import type { Profile } from "@/types";
import type { getStaffDashboard } from "@/features/approvals/data";
import { ApprovalList } from "@/features/approvals/approval-list";
import { StaffEmpty, StaffError, StaffStat } from "@/features/approvals/staff-widgets";
import { staffDate } from "@/features/approvals/presentation";
import { requestTitle, StudentStatus } from "@/features/izin/student-view";

export function StaffDashboard({ profile, data }: { profile: Profile; data: Awaited<ReturnType<typeof getStaffDashboard>> }) {
  const admin = profile.role === ROLES.ADMIN;
  const bk = profile.role === ROLES.GURU_BK;
  return <div className="flex flex-col gap-7 lg:gap-12">
    <section className="flex min-w-0 flex-col justify-center gap-5 rounded-[24px] bg-[#343b41] px-6 py-6 text-white sm:flex-row sm:items-center sm:justify-between lg:min-h-36 lg:px-8">
      <div className="min-w-0"><p className="mb-1 text-xs text-[#b9c1c8] lg:text-sm">Halo, {ROLE_LABELS[profile.role]}</p><h2 className="text-2xl leading-tight font-semibold wrap-anywhere lg:text-[32px]">{profile.full_name?.trim() || ROLE_LABELS[profile.role]}</h2></div>
      <Link href={admin ? "/admin" : APPROVALS_PATH} className="app-button staff-primary-action w-fit shrink-0 px-6 py-3">{admin ? "Kelola Data Sekolah" : "Tinjau Pengajuan"}</Link>
    </section>
    {data.failed ? <StaffError /> : <>
      <section aria-label="Ringkasan akun" className={`grid grid-cols-2 gap-3 lg:mt-4 lg:gap-4 ${admin || bk ? "xl:grid-cols-4" : "lg:grid-cols-3"}`}>
        {admin && data.school ? <>
          <StaffStat label="Total Siswa" value={data.school.students} />
          <StaffStat label="Total Guru" value={data.school.teachers} />
          <StaffStat label="Total Kelas" value={data.school.classes} />
          <StaffStat label="Perlu Persetujuan" value={data.pendingCount} tone="red" />
        </> : <>
          <StaffStat label="Perlu Persetujuan" value={data.pendingCount} tone="red" />
          <StaffStat label="Disetujui Hari Ini" value={data.statistics.approvedToday} tone="green" />
          <StaffStat label="Total Diputuskan" value={data.statistics.total} />
          {bk ? <StaffStat label="Eskalasi Lapis 3" value={data.layer3Count} tone="red" /> : null}
        </>}
      </section>
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,2.45fr)_minmax(235px,1fr)]">
        <section className="app-panel px-5 py-5 sm:px-7">
          <div className="mb-4 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm font-medium lg:text-base">Perlu Persetujuan <Clock3 className="size-4" strokeWidth={1.5} aria-hidden /></h3><Link href={APPROVALS_PATH} className="flex min-h-9 items-center text-xs whitespace-nowrap text-red-600 underline underline-offset-2">Lihat semua</Link></div>
          {data.pending.length ? <ApprovalList requests={data.pending} now={data.now} compact /> : <StaffEmpty title="Semua pengajuan sudah ditinjau" description="Pengajuan yang perlu keputusan Anda akan muncul di sini." />}
        </section>
        <aside className="flex min-w-0 flex-col gap-5">
          {admin && data.school ? <section className="app-panel p-6"><h3 className="mb-4 text-sm font-medium">Data Sekolah</h3><div className="divide-y divide-zinc-100">{[
            { label: "Siswa", value: data.school.students, href: ADMIN_STUDENTS_PATH, icon: GraduationCap },
            { label: "Guru", value: data.school.teachers, href: ADMIN_TEACHERS_PATH, icon: BookUser },
            { label: "Kelas", value: data.school.classes, href: ADMIN_CLASSES_PATH, icon: Users },
          ].map((item) => <Link key={item.href} href={item.href} className="flex min-h-14 items-center gap-3 text-xs hover:text-red-600"><item.icon className="size-4 text-zinc-400" aria-hidden /><span className="flex-1">{item.label}</span><span className="font-medium">{item.value}</span><ArrowUpRight className="size-3.5" aria-hidden /></Link>)}</div></section> : <section className="app-panel p-6"><h3 className="mb-4 flex items-center gap-2 text-sm font-medium">Keputusan Terbaru <Clock3 className="size-4" strokeWidth={1.5} aria-hidden /></h3>
            {data.recentDecisions.length ? <ul className="divide-y divide-zinc-100">{data.recentDecisions.map((item) => <li key={item.id} className="py-3"><Link href={`/persetujuan/${item.id}`} className="block truncate text-xs font-medium hover:text-red-600">{item.studentName}</Link><p className="mt-1 truncate text-[11px] text-[#747983]">{requestTitle(item.reason)}</p><div className="mt-2 flex flex-wrap items-center gap-2"><StudentStatus status={item.status} />{item.decidedAt ? <span className="text-[10px] text-[#747983]">{staffDate.format(new Date(item.decidedAt))}</span> : null}</div></li>)}</ul> : <StaffEmpty title="Belum ada keputusan" />}
            <Link href={APPROVAL_HISTORY_PATH} className="mt-3 inline-flex min-h-9 items-center text-xs text-red-600 underline underline-offset-2">Lihat riwayat keputusan</Link>
          </section>}
          {bk || admin ? <Link href={REKAP_PATH} className="app-panel flex min-h-20 items-center justify-between gap-3 p-6 text-sm font-medium hover:text-red-600">Rekap Perizinan <ArrowUpRight className="size-4" aria-hidden /></Link> : null}
        </aside>
      </div>
    </>}
    <p className="px-6 text-xs leading-relaxed text-[#747983] lg:-mt-5">*Catatan: Periksa notifikasi pengajuan izin siswa agar pengajuan dapat segera diproses.</p>
  </div>;
}
