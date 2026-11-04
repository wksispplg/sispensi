import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { ensureLetterPdf } from "@/features/surat/letter";
import { LOGIN_PATH } from "@/lib/constants";
import { LETTER_TOKEN_PATTERN, letterVerificationUrl } from "@/features/surat/qr";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!LETTER_TOKEN_PATTERN.test(token)) return new NextResponse("Surat tidak ditemukan.", { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  // Otorisasi lewat RLS: user hanya bisa membaca surat yang berhak ia lihat.
  const { data: allowed } = await supabase
    .from("digital_letters")
    .select("id")
    .eq("qr_token", token)
    .maybeSingle();
  if (!allowed) {
    return new NextResponse("Tidak diizinkan atau surat tidak ditemukan.", {
      status: 403,
    });
  }

  let result;
  try {
    const verifyUrl = letterVerificationUrl(token, request.url, process.env.NEXT_PUBLIC_APP_URL);
    result = await ensureLetterPdf(token, verifyUrl);
  } catch {
    console.error("[surat] Pembuatan PDF belum berhasil.");
    return new NextResponse("Surat belum dapat dibuat. Silakan coba lagi atau hubungi administrator SIPENSI.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!result) {
    return new NextResponse("Surat tidak ditemukan atau pengajuan belum disetujui.", { status: 404 });
  }

  return new NextResponse(Buffer.from(result.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Content-Length": String(result.bytes.byteLength),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
