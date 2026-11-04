import type { Metadata } from "next";

import { requireRole } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { QrScanner } from "./qr-scanner";

export const metadata: Metadata = { title: "Scan QR Surat Izin" };

export default async function ScanPage() {
  await requireRole(ROLES.GURU_MAPEL, ROLES.WALI_KELAS, ROLES.GURU_BK, ROLES.ADMIN);
  return (
    <div className="space-y-6 pb-4">
      <div><h1 className="text-2xl font-semibold tracking-tight">Scan QR Surat Izin</h1><p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">Pindai QR pada surat PDF siswa untuk memeriksa data dan persetujuan izinnya.</p></div>
      <QrScanner />
    </div>
  );
}
