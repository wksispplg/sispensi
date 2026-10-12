import Link from "next/link";
import { ArrowLeft, FileX2 } from "lucide-react";

import { DASHBOARD_PATH } from "@/lib/constants";
import { Button } from "@/components/ui/button";

/**
 * Dipakai saat halaman di dalam aplikasi memanggil notFound(), mis. pengajuan
 * yang tidak ada atau disembunyikan RLS karena pengguna tidak berhak.
 */
export default function AppNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <div className="bg-muted flex size-14 items-center justify-center rounded-full">
        <FileX2 className="text-muted-foreground size-7" aria-hidden />
      </div>
      <div>
        <h1 className="text-xl font-semibold">Data tidak ditemukan</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Data ini tidak ada, sudah dihapus, atau Anda tidak memiliki akses
          untuk melihatnya.
        </p>
      </div>
      <Button asChild>
        <Link href={DASHBOARD_PATH}>
          <ArrowLeft className="size-4" aria-hidden /> Kembali ke beranda
        </Link>
      </Button>
    </div>
  );
}
