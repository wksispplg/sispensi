import Link from "next/link";
import { ArrowUpRight, BarChart3, ScanLine } from "lucide-react";

import { ADMIN_HOME_PATH, REKAP_PATH, SCAN_PATH } from "@/lib/constants";
import type { Profile } from "@/types";
import type { getStaffDashboard } from "@/features/approvals/data";
import { StaffError, StaffStat } from "@/features/approvals/staff-widgets";
import { DataMasterGrid } from "../admin/data-master-grid";

type School = Awaited<ReturnType<typeof getStaffDashboard>>["school"];

export function AdminDashboard({ profile, school, failed }: { profile: Profile; school: School; failed: boolean }) {
  return <div className="flex flex-col gap-7 lg:gap-12">
    <section className="flex min-w-0 flex-col justify-center gap-5 rounded-[24px] bg-[#343b41] px-6 py-6 text-white sm:flex-row sm:items-center sm:justify-between lg:min-h-36 lg:px-8">
      <div className="min-w-0"><p className="mb-1 text-xs text-[#b9c1c8] lg:text-sm">Selamat datang, Administrator</p><h2 className="text-2xl leading-tight font-semibold wrap-anywhere lg:text-[32px]">{profile.full_name?.trim() || "Administrator"}</h2></div>
      <Link href={ADMIN_HOME_PATH} className="app-button staff-primary-action w-fit shrink-0 px-6 py-3">Kelola Data Sekolah</Link>
    </section>
    {failed || !school ? <StaffError /> : <>
      <section aria-label="Ringkasan data sekolah" className="grid grid-cols-2 gap-3 lg:mt-4 lg:gap-4 xl:grid-cols-4">
        <StaffStat label="Total Siswa" value={school.students} />
        <StaffStat label="Total Guru" value={school.teachers} />
        <StaffStat label="Total Kelas" value={school.classes} />
        <StaffStat label="Total Jadwal" value={school.schedules} />
      </section>
      <section aria-labelledby="school-management">
        <h3 id="school-management" className="mb-3 text-base font-medium">Kelola Sekolah</h3>
        <DataMasterGrid />
      </section>
      <section aria-label="Laporan dan verifikasi" className="grid gap-4 sm:grid-cols-2">
        {[
          { title: "Rekap Perizinan", description: "Lihat dan unduh laporan perizinan siswa.", href: REKAP_PATH, icon: BarChart3 },
          { title: "Scan QR Surat", description: "Periksa keaslian surat izin digital siswa.", href: SCAN_PATH, icon: ScanLine },
        ].map((item) => <Link key={item.href} href={item.href} className="app-panel flex min-w-0 items-center gap-4 p-6 hover:text-red-600">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600"><item.icon className="size-5" aria-hidden /></span>
          <div className="min-w-0 flex-1"><h3 className="text-sm font-medium">{item.title}</h3><p className="mt-1 text-xs leading-relaxed text-[#747983]">{item.description}</p></div>
          <ArrowUpRight className="size-4 shrink-0" aria-hidden />
        </Link>)}
      </section>
    </>}
  </div>;
}
