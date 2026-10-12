import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Halaman tidak ditemukan" };

/** 404 global: URL yang tidak cocok dengan rute mana pun. */
export default function NotFound() {
  return (
    <main className="bg-brand/5 flex min-h-svh flex-1 items-center justify-center p-4">
      <div className="bg-card flex w-full max-w-md flex-col items-center gap-4 rounded-xl border p-8 text-center shadow-sm">
        <div className="bg-brand/10 text-brand flex size-14 items-center justify-center rounded-full">
          <SearchX className="size-7" aria-hidden />
        </div>
        <div>
          <p className="text-brand text-sm font-semibold">404</p>
          <h1 className="mt-1 text-xl font-semibold">Halaman tidak ditemukan</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Alamat yang Anda buka tidak ada atau sudah dipindahkan. Periksa
            kembali tautannya.
          </p>
        </div>
        <Button asChild>
          <Link href="/">
            <ArrowLeft className="size-4" aria-hidden /> Kembali ke beranda
          </Link>
        </Button>
      </div>
    </main>
  );
}
