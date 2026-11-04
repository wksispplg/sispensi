"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Info, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { ANALYSIS_ENDPOINT, analysisResponseSchema, type AnalysisResponse } from "./contract";
import { cn } from "@/lib/utils";

const levelStyle = { Rendah: "bg-[#dcffda] text-[#3a7c00]", Sedang: "bg-amber-100 text-amber-800", Tinggi: "bg-red-100 text-red-700" };
const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" });

export function BkAnalysisButton({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => controllerRef.current?.abort(), []);

  const analyze = useCallback(async (refresh = false) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setPending(true); setError(null); setResult(null);
    try {
      const response = await fetch(ANALYSIS_ENDPOINT, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, refresh }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35_000)]),
      });
      if (response.redirected) throw new Error("Sesi sudah berakhir. Silakan masuk kembali untuk membuka analisis BK.");
      const body: unknown = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (!response.ok) {
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Analisis belum dapat dimuat. Silakan coba lagi.";
        throw new Error(message.slice(0, 250));
      }
      const parsed = analysisResponseSchema.safeParse(body);
      if (!parsed.success) throw new Error("Hasil analisis belum dapat dibaca. Silakan coba lagi.");
      setResult(parsed.data);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof TypeError ? "Server belum dapat dihubungi. Periksa koneksi, lalu coba lagi." : cause instanceof Error && cause.name !== "TimeoutError" ? cause.message : "Analisis membutuhkan waktu terlalu lama. Silakan coba lagi.");
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }, [studentId]);

  const close = () => { controllerRef.current?.abort(); setOpen(false); setPending(false); };
  return <>
    <button type="button" className="app-button min-h-9 gap-1.5 whitespace-nowrap px-3" aria-label={`Analisis AI BK untuk ${studentName}`} onClick={() => { setOpen(true); void analyze(); }}>
      <Sparkles className="size-3.5" aria-hidden />Analisis AI BK
    </button>
    {open ? <AnalysisDialog studentName={studentName} pending={pending} result={result} error={error} onClose={close} onAnalyze={() => void analyze(true)} /> : null}
  </>;
}

function AnalysisDialog({ studentName, pending, result, error, onClose, onAnalyze }: {
  studentName: string; pending: boolean; result: AnalysisResponse | null; error: string | null; onClose: () => void; onAnalyze: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  // Strict Mode menjalankan cleanup lalu membuka ulang dialog. Event close dari
  // cleanup dapat tiba belakangan; abaikan bila dialog sudah terbuka kembali.
  return <dialog ref={dialogRef} className="staff-decision-dialog" aria-labelledby={titleId} onClose={(event) => { if (!event.currentTarget.open) onClose(); }}>
    <header className="flex items-start justify-between gap-3 border-b border-zinc-100 px-6 py-5">
      <div className="min-w-0"><h2 id={titleId} className="flex items-center gap-2 text-base font-semibold"><Sparkles className="size-5 text-red-600" aria-hidden />Analisis AI BK</h2><p className="mt-1 text-xs text-zinc-500 wrap-anywhere">{studentName}</p></div>
      <button type="button" onClick={() => dialogRef.current?.close()} className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-zinc-100" aria-label="Tutup analisis BK"><X className="size-4" aria-hidden /></button>
    </header>
    <div className="space-y-5 p-6" aria-live="polite" aria-busy={pending}>
      {pending ? <div role="status" className="flex min-h-48 flex-col items-center justify-center gap-3 text-center"><Loader2 className="size-7 animate-spin text-red-600" aria-hidden /><p className="text-sm text-zinc-500">Menganalisis pola perizinan siswa…</p></div> : error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700 wrap-anywhere">{error}</p> : result ? <>
        {result.warning ? <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900"><Info className="mt-0.5 size-4 shrink-0" aria-hidden />{result.warning}</p> : <p className="text-xs text-zinc-500">Dibantu AI{result.cached ? " · Hasil tersimpan sementara" : ""}</p>}
        <div className="rounded-xl bg-[#f5f6f8] p-4 text-xs leading-relaxed text-zinc-600">
          <p>{result.scope.analyzed} dari {result.scope.total} pengajuan terbaru dianalisis.</p>
          {result.scope.from && result.scope.to ? <p className="mt-1">Waktu izin: {dateFormat.format(new Date(`${result.scope.from}T00:00:00+07:00`))} – {dateFormat.format(new Date(`${result.scope.to}T00:00:00+07:00`))}.</p> : null}
          <p className="mt-1">Riwayat per siswa, di luar filter tabel Rekap.</p>
        </div>
        {result.scope.analyzed ? <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">Prioritas peninjauan</h3><span className={cn("rounded-full px-3 py-1 text-xs font-medium", levelStyle[result.data.tingkat_risiko])}>{result.data.tingkat_risiko}</span></div> : null}
        <section><h3 className="mb-2 text-sm font-semibold">Ringkasan Pola</h3><p className="text-sm leading-relaxed text-zinc-600 wrap-anywhere">{result.data.ringkasan_pola}</p></section>
        <section><h3 className="mb-2 text-sm font-semibold">Saran Tindak Lanjut BK</h3><ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-600">{result.data.rekomendasi_bk.map((item, index) => <li key={index} className="wrap-anywhere">{item}</li>)}</ul></section>
        <p className="border-t border-zinc-100 pt-4 text-xs leading-relaxed text-zinc-500">Pola izin bukan penilaian kedisiplinan. Hasil ini menjadi bahan pertimbangan; keputusan izin dan tindak lanjut tetap pada Guru BK. Identitas, teks alasan, dan lampiran tidak dikirim ke layanan AI.</p>
      </> : null}
    </div>
    <footer className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 px-6 py-4">
      {!pending ? <button type="button" onClick={onAnalyze} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-zinc-300 px-4 text-xs hover:bg-zinc-50"><RefreshCw className="size-3.5" aria-hidden />{error ? "Coba lagi" : "Analisis ulang"}</button> : null}
      <button type="button" onClick={() => dialogRef.current?.close()} className="app-button px-5">Tutup</button>
    </footer>
  </dialog>;
}
