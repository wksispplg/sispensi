import Link from "next/link";
import { Clock3, Plus } from "lucide-react";
import { StudentEmpty, StudentRequestRows, type StudentRequest, type StudentStatistics } from "@/features/izin/student-view";
import type { Profile } from "@/types";

export function StudentDashboard({ profile, requests: list, statistics, failed }: { profile: Profile; requests: StudentRequest[]; statistics: StudentStatistics; failed: boolean }) {
  const stats = [
    { label: "Total Pengajuan", value: statistics.total, color: "text-black" },
    { label: "Menunggu", value: statistics.pending, color: "text-black" },
    { label: "Disetujui", value: statistics.approved, color: "text-[#489d00]" },
    { label: "Ditolak", value: statistics.rejected, color: "text-[#e00000]" },
  ];
  return <div className="flex flex-col gap-7 lg:gap-9">
    <section className="flex min-h-[108px] min-w-0 flex-col justify-center gap-5 rounded-[19px] border border-[#1c2832] bg-[#343b41] px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs leading-5 font-light text-[#bdc7ce]">Halo{profile.nis ? `, ${profile.nis}` : ""}</p>
        <h2 className="mt-0.5 text-xl leading-8 font-medium tracking-tight wrap-anywhere sm:text-2xl">{profile.full_name?.trim() || "Siswa"}</h2>
      </div>
      <Link href="/izin/ajukan" className="student-button w-fit shrink-0">Ajukan Dispen <Plus className="size-4" strokeWidth={1.5} aria-hidden /></Link>
    </section>
    {failed ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Data pengajuan belum dapat dimuat. Silakan muat ulang halaman.</p> : <>
      <section aria-label="Statistik pengajuan" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => <div key={stat.label} className="student-panel rounded-xl px-4 py-4">
          <p className="text-[11px] text-[#6f7380]">{stat.label}</p>
          <p className={`mt-1 text-[30px] leading-9 font-semibold tabular-nums ${stat.color}`}>{stat.value}</p>
        </div>)}
      </section>
      <section aria-labelledby="recent-requests" className="student-panel px-5 py-4 sm:px-7 sm:py-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 id="recent-requests" className="flex items-center gap-2 text-sm font-medium">Pengajuan Terbaru <Clock3 className="size-3.5" strokeWidth={1.5} aria-hidden /></h3>
          <Link href="/izin" className="py-2 text-xs whitespace-nowrap text-[#ed0000] underline underline-offset-2">Lihat semua</Link>
        </div>
        {list.length ? <StudentRequestRows requests={list.slice(0, 3)} /> : <StudentEmpty action />}
      </section>
    </>}
    <p className="-mt-4 px-4 text-[11px] leading-relaxed text-[#6f7380]">*Catatan: Ajukan dispen beberapa menit sebelumnya agar dapat diproses oleh guru mata pelajaran.</p>
  </div>;
}
