import { NextResponse, type NextRequest } from "next/server";

import { getProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { loadRekap, parseRekapFilters } from "@/features/rekap/data";
import {
  XLSX_MIME,
  buildRekapPdf,
  buildRekapXlsx,
  rekapFileBase,
} from "@/features/rekap/export";

/**
 * GET /rekap/export?format=xlsx|pdf&from=…&to=…&kelas=…&jenis=…&q=…
 * Mengunduh rekap sesuai filter. Hanya Guru BK & Admin.
 */
export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (
    !profile ||
    (profile.role !== ROLES.GURU_BK && profile.role !== ROLES.ADMIN)
  ) {
    return new NextResponse("Tidak diizinkan.", { status: 403 });
  }

  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const filters = parseRekapFilters(sp);
  const format = sp.format === "pdf" ? "pdf" : "xlsx";

  const data = await loadRekap(filters);
  const now = new Date();
  const bytes =
    format === "pdf"
      ? await buildRekapPdf(data, now)
      : await buildRekapXlsx(data, now);

  return new NextResponse(bytes as BodyInit, {
    headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : XLSX_MIME,
      "Content-Disposition": `attachment; filename="${rekapFileBase(data)}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}
