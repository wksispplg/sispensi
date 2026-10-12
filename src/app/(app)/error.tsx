"use client"; // Error boundary wajib Client Component

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";

import { DASHBOARD_PATH } from "@/lib/constants";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center"
    >
      <div className="bg-destructive/10 flex size-14 items-center justify-center rounded-full">
        <TriangleAlert className="text-destructive size-7" aria-hidden />
      </div>
      <div>
        <h1 className="text-xl font-semibold">Terjadi kesalahan</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Halaman gagal dimuat. Periksa koneksi internet lalu coba lagi. Jika
          masih terjadi, hubungi Administrator SIPENSI.
        </p>
        {error.digest ? (
          <p className="text-muted-foreground mt-2 font-mono text-xs">
            Kode: {error.digest}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => retry()}>
          <RotateCcw className="size-4" aria-hidden /> Coba lagi
        </Button>
        <Button variant="outline" asChild>
          <Link href={DASHBOARD_PATH}>Ke beranda</Link>
        </Button>
      </div>
    </div>
  );
}
