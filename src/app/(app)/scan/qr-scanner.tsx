"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, CameraOff, ImagePlus, LoaderCircle, ScanLine, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { extractLetterToken } from "@/features/surat/qr";
import { VerificationResult } from "@/features/surat/verification-result";
import { verifyScannedLetter, type ScanResult } from "./actions";

let decoderPromise: Promise<typeof import("jsqr")["default"]> | undefined;
const loadDecoder = () => decoderPromise ??= import("jsqr").then((library) => library.default).catch((error) => { decoderPromise = undefined; throw error; });

export function QrScanner() {
  const [camera, setCamera] = useState<"idle" | "starting" | "active">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [value, setValue] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraCycle = useRef(0);
  const requestSequence = useRef(0);
  const mounted = useRef(true);
  const lastToken = useRef("");

  const stopCamera = useCallback(() => {
    cameraCycle.current++;
    if (timerRef.current) clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamera("idle");
  }, []);

  useEffect(() => {
    mounted.current = true;
    const onHidden = () => { if (document.hidden) stopCamera(); };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      mounted.current = false;
      // Ini penghitung pembatalan, bukan referensi node DOM; gunakan nilai terbaru.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      cameraCycle.current++;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestSequence.current++;
      if (timerRef.current) clearTimeout(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [stopCamera]);

  async function verify(raw: string) {
    stopCamera();
    const sequence = ++requestSequence.current;
    const token = extractLetterToken(raw, window.location.origin, process.env.NEXT_PUBLIC_APP_URL);
    setError("");
    setResult(null);
    if (!token) { setError("QR atau tautan ini bukan surat SIPENSI dari website ini. Gunakan QR pada surat izin siswa."); return; }
    lastToken.current = token;
    setBusy(true);
    try {
      const response = await verifyScannedLetter(token);
      if (!mounted.current || requestSequence.current !== sequence) return;
      if (response.error) setError(response.error);
      else setResult(response);
    } catch {
      if (mounted.current && requestSequence.current === sequence) setError("Verifikasi belum berhasil. Periksa koneksi atau login kembali, lalu coba lagi.");
    } finally {
      if (mounted.current && requestSequence.current === sequence) setBusy(false);
    }
  }

  async function startCamera() {
    stopCamera();
    const cycle = cameraCycle.current;
    setError("");
    setCamera("starting");
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setCamera("idle");
      setError("Kamera memerlukan HTTPS atau localhost. Kamu tetap dapat mengunggah gambar QR atau memasukkan tautan surat.");
      return;
    }
    try {
      const decode = await loadDecoder();
      if (!mounted.current || cycle !== cameraCycle.current) return;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
      if (!mounted.current || cycle !== cameraCycle.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stopCamera(); return; }
      video.srcObject = stream;
      await video.play();
      if (!mounted.current || cycle !== cameraCycle.current) return;
      setCamera("active");
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("canvas");
      function scanFrame() {
        if (cycle !== cameraCycle.current || !mounted.current) return;
        try {
          if (video!.readyState >= 2 && video!.videoWidth) {
            const scale = Math.min(1, 960 / video!.videoWidth);
            canvas.width = Math.round(video!.videoWidth * scale);
            canvas.height = Math.round(video!.videoHeight * scale);
            context!.drawImage(video!, 0, 0, canvas.width, canvas.height);
            const image = context!.getImageData(0, 0, canvas.width, canvas.height);
            const qr = decode(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
            if (qr) { setValue(qr.data); void verify(qr.data); return; }
          }
          timerRef.current = setTimeout(scanFrame, 200);
        } catch {
          stopCamera();
          setError("Gambar kamera belum dapat dibaca. Coba lagi atau unggah gambar QR.");
        }
      }
      scanFrame();
    } catch (cause) {
      if (!mounted.current || cycle !== cameraCycle.current) return;
      stopCamera();
      const name = cause instanceof DOMException ? cause.name : "";
      setError(name === "NotAllowedError" ? "Izin kamera belum diberikan. Izinkan kamera di pengaturan browser, atau gunakan unggahan gambar."
        : name === "NotFoundError" ? "Kamera tidak ditemukan. Gunakan perangkat berkamera atau unggah gambar QR."
        : "Kamera belum dapat digunakan. Pastikan kamera tidak sedang dipakai aplikasi lain, lalu coba lagi.");
    }
  }

  async function readImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    stopCamera();
    setError("");
    setResult(null);
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError("Pilih gambar JPG, PNG, atau WebP berukuran maksimal 10 MB. Untuk PDF, gunakan foto atau tangkapan layar QR-nya.");
      return;
    }
    setBusy(true);
    const sequence = ++requestSequence.current;
    let bitmap: ImageBitmap | undefined;
    try {
      const decode = await loadDecoder();
      bitmap = await createImageBitmap(file);
      if (!mounted.current || sequence !== requestSequence.current) return;
      if (bitmap.width * bitmap.height > 40_000_000) throw new Error("large");
      const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("canvas");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const qr = decode(pixels.data, pixels.width, pixels.height, { inversionAttempts: "attemptBoth" });
      if (!qr) { setError("QR belum terbaca. Gunakan gambar yang lebih jelas, tidak terpotong, dan cukup terang."); return; }
      setValue(qr.data);
      await verify(qr.data);
    } catch {
      if (mounted.current && requestSequence.current === sequence) setError("Gambar belum dapat dibaca. Coba foto atau tangkapan layar lain yang lebih kecil dan jelas.");
    } finally {
      bitmap?.close();
      if (mounted.current) setBusy(false);
    }
  }

  function submit(event: FormEvent) { event.preventDefault(); void verify(value); }

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section aria-labelledby="scan-heading" className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
        <h2 id="scan-heading" className="flex items-center gap-2 text-lg font-semibold"><ScanLine className="text-brand size-5" aria-hidden />Pindai surat siswa</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">Arahkan kamera ke QR pada surat izin yang ditunjukkan siswa.</p>
        <div className="relative mt-5 aspect-[4/3] overflow-hidden rounded-2xl bg-zinc-950">
          <video ref={videoRef} aria-label="Pratinjau kamera pemindai QR" muted playsInline className="size-full object-cover" />
          {camera === "active" ? <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="size-44 rounded-2xl border-2 border-white/90 shadow-[0_0_0_999px_rgb(0_0_0/0.25)]" /></div>
            : <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white"><ScanLine className="size-12 text-white/70" aria-hidden /><p className="text-sm text-white/80">{camera === "starting" ? "Menyiapkan kamera…" : "Kamera belum dinyalakan"}</p></div>}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {camera === "idle" ? <Button type="button" onClick={() => void startCamera()} disabled={busy}><Camera className="size-4" aria-hidden />Nyalakan kamera</Button>
            : <Button type="button" variant="outline" onClick={stopCamera}><CameraOff className="size-4" aria-hidden />Hentikan kamera</Button>}
          <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-2 overflow-hidden rounded-lg border px-4 text-sm font-medium hover:bg-zinc-50 focus-within:ring-2 focus-within:ring-brand sm:min-h-9">
            <ImagePlus className="size-4" aria-hidden />Unggah gambar QR
            <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Unggah gambar QR" disabled={busy || camera === "starting"} onChange={(event) => void readImage(event)} className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed" />
          </label>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">JPG, PNG, atau WebP, maksimal 10 MB. Gambar dipindai di perangkat ini. Jika surat berupa PDF, gunakan foto atau tangkapan layar bagian QR.</p>
        <form onSubmit={submit} className="mt-6 space-y-2 border-t pt-5">
          <Label htmlFor="letter-qr-value">Atau masukkan tautan / token surat</Label>
          <div className="flex flex-col gap-2 sm:flex-row"><Input id="letter-qr-value" value={value} maxLength={2048} onChange={(event) => setValue(event.target.value)} placeholder="Tempel tautan dari QR surat" autoComplete="off" className="min-w-0 flex-1" /><Button type="submit" variant="outline" disabled={busy || !value.trim()}>Periksa surat</Button></div>
        </form>
      </section>

      <section aria-labelledby="result-heading" className="min-w-0 self-start rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
        <h2 id="result-heading" className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="text-brand size-5" aria-hidden />Hasil verifikasi</h2>
        <div className="mt-5">
          {busy ? <p role="status" className="flex items-center gap-2 py-8 text-sm text-zinc-500"><LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />Memeriksa surat…</p>
            : error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-800">{error}</div>
              : result?.info ? <><VerificationResult info={result.info} checkedAt={result.checkedAt} /><Button type="button" variant="outline" className="mt-5" onClick={() => void verify(lastToken.current)}>Periksa ulang status</Button></>
                : <div className="rounded-xl border border-dashed bg-zinc-50 px-5 py-10 text-center"><ShieldCheck className="mx-auto size-10 text-zinc-300" aria-hidden /><p className="mt-3 text-sm font-medium text-zinc-700">Belum ada surat yang dipindai</p><p className="mt-2 text-sm leading-relaxed text-zinc-500">Nama, kelas, waktu izin, dan status persetujuan akan tampil di sini setelah QR terbaca.</p></div>}
        </div>
      </section>
    </div>
  );
}
