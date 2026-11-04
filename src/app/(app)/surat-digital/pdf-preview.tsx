"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist";

/** Render byte PDF yang sama dengan unduhan, tanpa bergantung pada plugin PDF browser. */
export function PdfPreview({ token }: { token: string }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let loading: PDFDocumentLoadingTask | undefined;
    let active = true;
    async function load() {
      const response = await fetch(`/surat/${token}?preview=1`, { signal: controller.signal, cache: "no-store" });
      if (!response.ok || !response.headers.get("Content-Type")?.includes("application/pdf")) throw new Error("PDF unavailable");
      const bytes = await response.arrayBuffer();
      const pdfjs = await import("pdfjs-dist");
      if (!active) return;
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      loading = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
      const pdf = await loading.promise;
      if (active) setDocument(pdf);
    }
    load().catch(() => { if (active) setError(true); });
    return () => { active = false; controller.abort(); loading?.destroy().catch(() => {}); };
  }, [token, retry]);

  return <div className="rounded-2xl bg-[#f3f4f6] p-3 sm:p-4">
    {document ? <div className="max-h-[700px] space-y-4 overflow-y-auto" aria-label="Halaman surat izin">
      {Array.from({ length: document.numPages }, (_, index) => <PdfPage key={index} document={document} number={index + 1} />)}
    </div> : <div className="flex min-h-[480px] flex-col items-center justify-center gap-3 text-center text-xs text-[#6f7380]">
      {error ? <><p>Pratinjau belum dapat dimuat.</p><button type="button" className="text-red-600 underline" onClick={() => { setError(false); setRetry((value) => value + 1); }}>Coba lagi</button></> : <><Loader2 className="size-5 animate-spin" aria-hidden /><p role="status">Menyiapkan surat…</p></>}
    </div>}
    <a href={`/surat/${token}?preview=1`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-8 items-center gap-1.5 text-[11px] text-[#666d79] underline underline-offset-2">Buka surat di tab baru <ExternalLink className="size-3" aria-hidden /></a>
  </div>;
}

function PdfPage({ document, number }: { document: PDFDocumentProxy; number: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let rendering: RenderTask | undefined;
    async function render() {
      const page = await document.getPage(number);
      const canvas = canvasRef.current;
      if (!active || !canvas) return;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      const viewport = page.getViewport({ scale: 1.5 });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      rendering = page.render({ canvasContext: context, canvas, viewport });
      await rendering.promise;
    }
    render().catch(() => { if (active) setFailed(true); });
    return () => { active = false; rendering?.cancel(); };
  }, [document, number]);
  return failed ? <p role="alert" className="p-5 text-center text-xs text-red-700">Halaman {number} belum dapat ditampilkan. Gunakan tombol Unduh PDF untuk membuka surat.</p> : <canvas ref={canvasRef} role="img" aria-label={`Surat izin, halaman ${number} dari ${document.numPages}`} className="block h-auto w-full bg-white shadow-sm" />;
}
