"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, Clock3, FileText, X } from "lucide-react";

import { ROLES, STUDENT_LETTERS_PATH, type Role } from "@/lib/constants";
import { notificationGroup, notificationKind, type StudentNotification } from "@/features/notifications/presentation";
import { StudentEmpty } from "@/features/izin/student-view";
import { DecisionActions } from "@/features/approvals/decision-actions";
import type { ApprovalItem } from "@/features/approvals/presentation";
import { cn } from "@/lib/utils";
import { readNotifications } from "./actions";

const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

export function NotificationList({ initialItems, now, role = ROLES.SISWA, pendingRequests = [] }: { initialItems: StudentNotification[]; now: number; role?: Role; pendingRequests?: ApprovalItem[] }) {
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const staff = role !== ROLES.SISWA;
  const items = initialItems.map((item) => readIds.has(item.id) ? { ...item, is_read: true } : item);
  const pendingMap = new Map(pendingRequests.map((request) => [request.id, request]));
  const unread = items.filter((item) => !item.is_read).length;
  const visible = items.filter((item) => filter === "all" || (filter === "unread" ? !item.is_read : filter === "letters" ? ["letter", "approved"].includes(notificationKind(item)) : notificationKind(item) !== "letter"));

  function read(item?: StudentNotification) {
    startTransition(async () => {
      const result = await readNotifications(item?.id);
      if (result.error) { setError(result.error); return; }
      setError(null);
      setReadIds((previous) => new Set([...previous, ...(item ? [item.id] : initialItems.map((entry) => entry.id))]));
      if (item?.request_id) router.push(staff ? `/persetujuan/${item.request_id}` : notificationKind(item) === "letter" || (filter === "letters" && notificationKind(item) === "approved") ? `${STUDENT_LETTERS_PATH}?pengajuan=${item.request_id}` : `/izin/${item.request_id}`);
      router.refresh();
    });
  }

  return <section className={cn("app-panel min-h-[540px] px-5 py-6 sm:px-7 lg:mt-3", staff && "lg:min-h-[720px] lg:px-8")}>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div aria-label="Filter notifikasi" className="flex flex-wrap gap-2">{[["all", "Semua"], ["unread", `Belum dibaca (${unread})`], ["requests", "Pengajuan"], ["letters", "Surat izin"]].map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value} className={staff ? "app-tab" : "student-tab"}>{label}</button>)}</div>
      {unread ? <button type="button" disabled={pending} onClick={() => read()} className="inline-flex min-h-8 items-center gap-1.5 text-[10px] text-[#6f7380] hover:text-red-600 disabled:opacity-50"><CheckCheck className="size-3.5" aria-hidden />Tandai semua dibaca</button> : null}
    </div>
    {error ? <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p> : null}
    {!visible.length ? <StudentEmpty title="Tidak ada notifikasi" description={items.length ? "Tidak ada notifikasi pada filter ini." : "Perkembangan pengajuan izin akan muncul di sini."} /> : <div className="space-y-5">
      {(["Hari ini", "Kemarin", "Sebelumnya"] as const).map((group) => {
        const grouped = visible.filter((item) => notificationGroup(item.created_at, now) === group);
        if (!grouped.length) return null;
        return <section key={group} aria-label={group}><h2 className="mb-2 text-[10px] font-medium text-[#343b41] uppercase">{group}</h2><ul className="space-y-1">{grouped.map((item) => {
          const kind = notificationKind(item);
          const Icon = kind === "approved" ? Check : kind === "rejected" ? X : kind === "letter" ? FileText : Clock3;
          const request = item.request_id ? pendingMap.get(item.request_id) : undefined;
          return <li key={item.id} className="grid min-w-0 grid-cols-[28px_minmax(0,1fr)_auto_8px] items-start gap-x-3 gap-y-1 rounded-xl px-2 py-3 hover:bg-zinc-50/70">
            <span className={cn("mt-0.5 flex size-7 items-center justify-center rounded-full", kind === "approved" ? "bg-[#dcffda] text-[#52a800]" : kind === "rejected" ? "bg-red-100 text-red-500" : kind === "pending" ? "bg-amber-100 text-amber-600" : "bg-zinc-100 text-zinc-500")}><Icon className="size-4" strokeWidth={1.5} aria-hidden /></span>
            <button type="button" disabled={pending} onClick={() => read(item)} className="block min-w-0 w-full text-left focus-visible:outline-2 focus-visible:outline-red-300 disabled:opacity-60"><span className="block text-xs font-medium wrap-anywhere lg:text-[13px]">{item.title ?? "Pembaruan pengajuan"}</span><span className="mt-1 block text-[11px] leading-relaxed text-[#6f7380] wrap-anywhere lg:text-xs">{item.message}</span></button>
            <time dateTime={item.created_at} title={new Date(item.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} className="mt-0.5 text-[11px] text-[#6f7380]">{time.format(new Date(item.created_at))}</time>
            <span className={cn("mt-1.5 size-2 rounded-full", item.is_read ? "bg-transparent" : "bg-[#f00000]")}><span className="sr-only">{item.is_read ? "Sudah dibaca" : "Belum dibaca"}</span></span>
            {staff && item.request_id ? <div className="col-span-4 mt-1 flex min-w-0 flex-wrap items-center gap-3 sm:col-span-3 sm:col-start-2">{request ? <DecisionActions request={request} /> : null}<Link href={`/persetujuan/${item.request_id}`} className="inline-flex min-h-9 items-center text-xs text-red-600 underline underline-offset-2">Lihat detail</Link></div> : null}
          </li>;
        })}</ul></section>;
      })}
    </div>}
  </section>;
}
