import type { Metadata } from "next";
import { GraduationCap, ShieldX } from "lucide-react";

import { readLetterVerification } from "@/features/surat/verification-data";
import { VerificationResult } from "@/features/surat/verification-result";
import { LETTER_TOKEN_PATTERN } from "@/features/surat/qr";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import type { LetterVerification } from "@/features/surat/verification";

export const metadata: Metadata = { title: "Verifikasi Surat Izin" };
export const dynamic = "force-dynamic";

export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let info: LetterVerification | null = null;
  let unavailable = false;
  if (LETTER_TOKEN_PATTERN.test(token)) {
    try { info = await readLetterVerification(token); } catch { unavailable = true; }
  }
  return (
    <main className="bg-muted/40 flex min-h-svh flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="items-center text-center">
          <div className="bg-primary text-primary-foreground mx-auto mb-1 flex size-11 items-center justify-center rounded-xl"><GraduationCap className="size-6" aria-hidden /></div>
          <CardTitle className="text-lg">Verifikasi Surat Izin</CardTitle>
          <p className="text-muted-foreground text-sm">SIPENSI — SMK Telkom Purwokerto</p>
        </CardHeader>
        <CardContent>
          {info ? <VerificationResult info={info} checkedAt={new Date().toISOString()} /> : <div className="flex flex-col items-center gap-2 py-4 text-center">
            <ShieldX className="text-destructive size-10" aria-hidden />
            <p className="font-medium">{unavailable ? "Verifikasi belum tersedia" : "Surat tidak ditemukan"}</p>
            <p className="text-muted-foreground text-sm">{unavailable ? "Data surat belum dapat dihubungi. Silakan coba lagi atau hubungi administrator SIPENSI." : "QR Code tidak valid atau surat tidak terdaftar di sistem."}</p>
          </div>}
        </CardContent>
      </Card>
    </main>
  );
}
