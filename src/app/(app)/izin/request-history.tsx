"use client";

import { useState } from "react";
import { REQUEST_STATUS } from "@/lib/constants";
import { StudentEmpty, StudentRequestRows, type StudentRequest } from "@/features/izin/student-view";

export function RequestHistory({ requests }: { requests: StudentRequest[] }) {
  const [filter, setFilter] = useState("all");
  const filters = [
    ["all", "Semua"], [REQUEST_STATUS.PENDING, "Menunggu"],
    [REQUEST_STATUS.APPROVED, "Disetujui"], [REQUEST_STATUS.REJECTED, "Ditolak"],
  ];
  const visible = requests.filter((request) => filter === "all" || request.status === filter);
  return <section className="student-panel px-5 py-6 sm:px-7">
    <div aria-label="Filter status pengajuan" className="mb-4 flex flex-wrap gap-2">
      {filters.map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} className="student-tab" onClick={() => setFilter(value)}>{label}</button>)}
    </div>
    {visible.length ? <StudentRequestRows requests={visible} /> : <StudentEmpty title={requests.length ? "Tidak ada pengajuan pada status ini" : "Belum ada pengajuan"} action={!requests.length} />}
  </section>;
}
