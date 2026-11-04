"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";

import { APPROVAL_ACTIONS, IZIN_TYPE_LABELS } from "@/lib/constants";
import { useFormAction } from "@/hooks/use-form-action";
import { lessonRangeLabel } from "@/features/izin/lesson-periods";
import { saveDecision, type DecisionState } from "./actions";
import { staffDateTime, type ApprovalItem } from "./presentation";

type Intent = typeof APPROVAL_ACTIONS.APPROVED | typeof APPROVAL_ACTIONS.REJECTED;

export function DecisionActions({ request }: { request: ApprovalItem }) {
  const [intent, setIntent] = useState<Intent | null>(null);
  return <>
    <div className="flex shrink-0 items-center gap-2">
      <button type="button" onClick={() => setIntent(APPROVAL_ACTIONS.REJECTED)} className="inline-flex min-h-9 items-center justify-center rounded-full border border-[#9a9da5] px-4 text-xs hover:bg-zinc-50" aria-label={`Tolak pengajuan ${request.studentName}`}>Tolak</button>
      <button type="button" onClick={() => setIntent(APPROVAL_ACTIONS.APPROVED)} className="app-button px-4 py-1.5" aria-label={`Setujui pengajuan ${request.studentName}`}>Setujui</button>
    </div>
    {intent ? <DecisionDialog key={`${request.id}:${intent}`} request={request} intent={intent} onDismiss={() => setIntent(null)} /> : null}
  </>;
}

function DecisionDialog({ request, intent, onDismiss }: { request: ApprovalItem; intent: Intent; onDismiss: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const noteId = useId();
  const [state, formProps, pending] = useFormAction<DecisionState>(saveDecision, {});
  const router = useRouter();
  const reject = intent === APPROVAL_ACTIONS.REJECTED;
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  useEffect(() => {
    if (state.ok) {
      toast.success("Keputusan tersimpan.");
      dialogRef.current?.close();
      router.refresh();
    }
  }, [state.ok, router]);
  return <dialog ref={dialogRef} onClose={onDismiss} onCancel={(event) => { if (pending) event.preventDefault(); }} aria-labelledby={titleId} className="staff-decision-dialog">
    <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-5">
      <h2 id={titleId} className="text-base font-semibold">{reject ? "Tolak pengajuan" : "Setujui pengajuan"}</h2>
      <button type="button" disabled={pending} onClick={() => dialogRef.current?.close()} aria-label="Tutup dialog keputusan" className="flex size-9 items-center justify-center rounded-full hover:bg-zinc-100 disabled:opacity-50"><X className="size-4" /></button>
    </div>
    <div className="space-y-5 p-6">
      <div><p className="font-semibold wrap-anywhere">{request.studentName}</p><p className="mt-1 text-xs text-zinc-500">{request.className ?? "Tanpa kelas"} · {IZIN_TYPE_LABELS[request.izinType]}</p></div>
      <dl className="space-y-3 text-sm">
        <div><dt className="mb-1 text-xs text-zinc-500">Alasan pengajuan</dt><dd className="whitespace-pre-line wrap-anywhere">{request.reason}</dd></div>
        <div><dt className="mb-1 text-xs text-zinc-500">Waktu izin</dt><dd>{staffDateTime.format(new Date(request.requestedAt))}</dd><dd className="mt-1 text-xs text-zinc-500">{lessonRangeLabel(request.lessonPeriodStart, request.lessonPeriodEnd)}</dd></div>
      </dl>
      <Link href={`/persetujuan/${request.id}`} className="inline-flex min-h-9 items-center text-xs font-medium text-red-600 underline underline-offset-4">Lihat detail dan bukti pendukung</Link>
      <form {...formProps} className="space-y-4">
        <input type="hidden" name="id" value={request.id} />
        <input type="hidden" name="_action" value={intent} />
        <div><label htmlFor={noteId} className="mb-2 block text-xs font-medium">{reject ? "Alasan penolakan" : "Catatan (opsional)"}</label><textarea id={noteId} name="note" required={reject} maxLength={1000} rows={3} className="w-full rounded-xl border border-zinc-300 p-3 text-base outline-none focus:ring-2 focus:ring-red-200 sm:text-sm" placeholder={reject ? "Jelaskan alasan penolakan…" : "Tambahkan catatan bila diperlukan…"} /></div>
        {state.error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{state.error}</p> : null}
        <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={pending} onClick={() => dialogRef.current?.close()} className="min-h-10 rounded-full border border-zinc-300 px-5 text-xs hover:bg-zinc-50">Batal</button><button type="submit" disabled={pending} className="app-button">{pending ? "Menyimpan…" : reject ? "Tolak Pengajuan" : "Setujui Pengajuan"}</button></div>
      </form>
    </div>
  </dialog>;
}
