import Link from "next/link";
import { IZIN_TYPE_LABELS } from "@/lib/constants";
import { requestTitle } from "@/features/izin/student-view";
import { DecisionActions } from "./decision-actions";
import { relativeRequestTime, staffDateTime, type ApprovalItem } from "./presentation";

export function ApprovalList({ requests, now, compact = false }: { requests: ApprovalItem[]; now: number; compact?: boolean }) {
  return <ul className="divide-y divide-[#eceef2]">
    {requests.map((request) => <li key={request.id} className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 py-4 ${compact ? "xl:grid-cols-[minmax(0,1fr)_90px_auto]" : "lg:grid-cols-[minmax(0,1fr)_125px_auto]"}`}>
      <div className={`col-span-2 min-w-0 ${compact ? "xl:col-span-1" : "lg:col-span-1"}`}>
        <Link href={`/persetujuan/${request.id}`} className="block truncate text-[13px] font-medium hover:text-red-600" title={`${request.studentName} — ${requestTitle(request.reason)}`}>{request.studentName} — {requestTitle(request.reason)}</Link>
        <p className="mt-1 truncate text-xs leading-relaxed text-[#747983]">{IZIN_TYPE_LABELS[request.izinType]} · {request.hasEvidence ? "Bukti terlampir" : "Tanpa bukti"}{request.className ? ` · ${request.className}` : ""}</p>
        {!compact ? <p className="mt-1 text-[11px] text-[#747983]">Lapis {request.currentLayer}{request.deadline ? ` · Batas respons ${staffDateTime.format(new Date(request.deadline))}` : ""}</p> : null}
      </div>
      <time dateTime={request.createdAt} title={staffDateTime.format(new Date(request.createdAt))} className="text-[11px] text-[#747983]">{relativeRequestTime(request.createdAt, now)}</time>
      <div className="flex justify-end"><DecisionActions request={request} /></div>
    </li>)}
  </ul>;
}
