import Link from "next/link";
import { FilePlus2 } from "lucide-react";

import { IZIN_TYPE_LABELS, REQUEST_STATUS, type IzinType, type RequestStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const studentDate = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta",
});

/** Pengajuan lama tetap memakai alasan asli; pengajuan baru memakai baris pertama sebagai judul. */
export function requestTitle(reason: string): string {
  return reason.trim().split(/\r?\n/)[0] || "Pengajuan izin";
}

export type StudentRequest = {
  id: string;
  reason: string;
  izin_type: IzinType;
  status: RequestStatus;
  created_at: string;
  requested_at: string;
  requested_until: string | null;
  lesson_period_start: number | null;
  lesson_period_end: number | null;
};

export type StudentStatistics = { total: number; pending: number; approved: number; rejected: number };

export function StudentStatus({ status }: { status: RequestStatus }) {
  const labels: Record<RequestStatus, string> = {
    pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak",
    cancelled: "Dibatalkan", expired: "Kedaluwarsa",
  };
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-3 py-1 text-[11px] font-medium", {
    "bg-[#dcffda] text-[#3a7c00]": status === REQUEST_STATUS.APPROVED,
    "bg-amber-50 text-amber-700": status === REQUEST_STATUS.PENDING,
    "bg-red-50 text-red-600": status === REQUEST_STATUS.REJECTED,
    "bg-zinc-100 text-zinc-500": status === REQUEST_STATUS.CANCELLED || status === REQUEST_STATUS.EXPIRED,
  })}>{labels[status]}</span>;
}

export function StudentRequestRows({ requests }: { requests: StudentRequest[] }) {
  return <ul className="divide-y divide-[#eceef2]">
    {requests.map((request) => <li key={request.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-2 sm:grid-cols-[minmax(0,1fr)_105px_100px_48px] sm:gap-x-5">
      <div className="min-w-0">
        <p className="truncate text-xs leading-4 font-medium" title={requestTitle(request.reason)}>{requestTitle(request.reason)}</p>
        <p className="mt-0.5 truncate text-[11px] leading-[14px] text-[#6f7380]">{IZIN_TYPE_LABELS[request.izin_type]}</p>
      </div>
      <time dateTime={request.created_at} className="row-start-2 text-[11px] whitespace-nowrap text-[#7d808b] sm:row-auto">{studentDate.format(new Date(request.created_at))}</time>
      <div className="col-start-2 row-start-1 sm:col-auto sm:row-auto"><StudentStatus status={request.status} /></div>
      <Link href={`/izin/${request.id}`} className="col-start-2 row-start-2 -my-2 flex min-h-9 items-center justify-end text-xs text-[#ed0000] underline underline-offset-2 hover:text-red-800 sm:col-auto sm:row-auto">Detail<span className="sr-only"> {requestTitle(request.reason)}</span></Link>
    </li>)}
  </ul>;
}

export function StudentEmpty({ title = "Belum ada pengajuan", description = "Pengajuan izin Anda akan ditampilkan di sini.", action = false }: { title?: string; description?: string; action?: boolean }) {
  return <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
    <span className="flex size-11 items-center justify-center rounded-full bg-[#f5f6f8] text-zinc-400"><FilePlus2 className="size-5" aria-hidden /></span>
    <p className="text-sm font-medium">{title}</p>
    <p className="max-w-sm text-xs leading-relaxed text-[#6f7380]">{description}</p>
    {action ? <Link href="/izin/ajukan" className="student-button mt-1">Ajukan Dispen</Link> : null}
  </div>;
}
