"use client";

import { useState } from "react";
import Link from "next/link";
import { IZIN_TYPE_LABELS, REQUEST_STATUS } from "@/lib/constants";
import { requestTitle, StudentStatus } from "@/features/izin/student-view";
import { staffDate, type DecisionItem, type DecisionStatistics } from "@/features/approvals/presentation";
import { StaffEmpty, StaffStat } from "@/features/approvals/staff-widgets";

export function DecisionHistory({ requests, statistics }: { requests: DecisionItem[]; statistics: DecisionStatistics }) {
  const [filter, setFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const filtered = requests.filter((item) => filter === "all" || item.status === filter);
  const visible = showAll ? filtered : filtered.slice(0, 4);
  return <div className="space-y-6 pt-2 lg:pt-3">
    <section aria-label="Statistik keputusan Anda" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <StaffStat label="Total Diputuskan" value={statistics.total} />
      <StaffStat label="Disetujui" value={statistics.approved} tone="green" />
      <StaffStat label="Ditolak" value={statistics.rejected} tone="red" />
      <StaffStat label="Disetujui Hari Ini" value={statistics.approvedToday} />
    </section>
    <section className="app-panel px-5 py-6 sm:px-8">
      <div aria-label="Filter riwayat keputusan" className="mb-5 flex flex-wrap gap-3">{[["all", "Semua"], [REQUEST_STATUS.APPROVED, "Disetujui"], [REQUEST_STATUS.REJECTED, "Ditolak"]].map(([value, label]) => <button key={value} type="button" className="app-tab" aria-pressed={filter === value} onClick={() => { setFilter(value); setShowAll(false); }}>{label}</button>)}</div>
      {visible.length ? <ul className="divide-y divide-[#eceef2]">{visible.map((item) => <li key={item.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-4 sm:grid-cols-[minmax(0,1fr)_115px_105px_45px]">
        <div className="min-w-0"><p className="truncate text-[13px] font-medium">{requestTitle(item.reason)}</p><p className="mt-1 truncate text-xs text-[#747983]">{IZIN_TYPE_LABELS[item.izinType]}</p><p className="mt-1 truncate text-[11px] text-[#747983]">{item.studentName}{item.className ? ` · ${item.className}` : ""}</p></div>
        <time dateTime={item.decidedAt ?? undefined} className="row-start-2 text-xs text-[#747983] sm:row-auto">{item.decidedAt ? staffDate.format(new Date(item.decidedAt)) : "—"}</time>
        <div className="col-start-2 row-start-1 sm:col-auto sm:row-auto"><StudentStatus status={item.status} /></div>
        <Link href={`/persetujuan/${item.id}`} className="col-start-2 row-start-2 flex min-h-9 items-center justify-end text-xs text-red-600 underline underline-offset-2 sm:col-auto sm:row-auto">Detail<span className="sr-only"> {requestTitle(item.reason)} — {item.studentName}</span></Link>
      </li>)}</ul> : <StaffEmpty title={requests.length ? "Tidak ada keputusan pada status ini" : "Belum ada keputusan"} description="Keputusan yang Anda buat akan ditampilkan di sini." />}
      {filtered.length > 4 ? <button type="button" onClick={() => setShowAll((value) => !value)} className="mx-auto mt-4 block min-h-10 text-xs underline underline-offset-2">{showAll ? "Tampilkan lebih sedikit" : `Tampilkan semua (${filtered.length})`}</button> : null}
    </section>
  </div>;
}
