/**
 * Pembuat file ekspor rekap: Excel (.xlsx via exceljs) & PDF (via pdf-lib).
 * Hanya mengimpor TIPE dari modul aplikasi agar mudah diuji terpisah.
 */
import type { Worksheet } from "exceljs";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import type { RekapData, RekapRow } from "@/features/rekap/data";

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const fmt = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});
const fmtDT = (iso: string | null) => (iso ? fmt.format(new Date(iso)) : "");

/** Nama file dasar, mis. "rekap-izin_2026-09-01_sd_2026-09-30". */
export function rekapFileBase(d: RekapData): string {
  return `rekap-izin_${d.filters.from}_sd_${d.filters.to}`;
}

/** Keterangan tambahan per baris (tolak otomatis, keterlambatan, dsb.). */
function keterangan(r: RekapRow): string {
  if (r.autoRejected) return "Ditolak otomatis (tidak ditanggapi > 1 hari)";
  if (r.lateMinutes && r.lateMinutes > 0) {
    return r.returnedAt
      ? `Terlambat kembali ${r.lateMinutes} menit`
      : `Belum kembali, lewat ${r.lateMinutes} menit`;
  }
  if (r.status === "pending") return `Menunggu Lapis ${r.layer}`;
  if (r.returnedAt) return "Kembali tepat waktu";
  return "";
}

function summaryRows(d: RekapData): [string, number][] {
  return [
    ["Total pengajuan", d.total],
    ["Disetujui", d.approved],
    ["Ditolak", d.rejected],
    ["   di antaranya ditolak otomatis", d.autoRejected],
    ["Menunggu", d.pending],
    ["Eskalasi sampai Lapis 3", d.escalatedL3],
    ["Terlambat kembali dari dispen", d.lateReturns],
  ];
}

// ===========================================================================
// Excel
// ===========================================================================
const BRAND_ARGB = "FFDC2026";

function styleHeaderRow(ws: Worksheet, rowNumber: number) {
  const row = ws.getRow(rowNumber);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_ARGB } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
}

function addSection(ws: Worksheet, title: string, rows: [string, number][]) {
  const header = ws.addRow([title, "Jumlah"]);
  styleHeaderRow(ws, header.number);
  for (const r of rows) ws.addRow(r);
  ws.addRow([]);
}

export async function buildRekapXlsx(
  d: RekapData,
  generatedAt: Date,
): Promise<Uint8Array> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "SIPENSI";
  wb.created = generatedAt;

  // --- Sheet 1: Ringkasan ---
  const ws = wb.addWorksheet("Ringkasan");
  ws.columns = [{ width: 46 }, { width: 14 }];
  ws.addRow(["Rekap Perizinan Siswa — SIPENSI"]).font = { bold: true, size: 14 };
  ws.addRow(["SMK Telkom Purwokerto"]);
  ws.addRow([`Periode: ${d.filters.from} s/d ${d.filters.to}`]);
  ws.addRow([`Filter: ${d.filterLabel}`]);
  ws.addRow([`Dibuat: ${fmt.format(generatedAt)} WIB`]);
  if (d.capped) {
    ws.addRow([`Catatan: data dibatasi ${d.total} pengajuan terbaru.`]);
  }
  ws.addRow([]);
  addSection(ws, "Ringkasan", summaryRows(d));
  addSection(ws, "Per Status", d.byStatus.map((i) => [i.label, i.value]));
  addSection(ws, "Per Jenis Izin", d.byIzin.map((i) => [i.label, i.value]));
  addSection(ws, "Per Kelas", d.byClass.map((i) => [i.label, i.value]));
  addSection(
    ws,
    `Tren ${d.monthly ? "Bulanan" : "Harian"}`,
    d.trend.map((t) => [t.label, t.value]),
  );

  // --- Sheet 2: Data Pengajuan ---
  const data = wb.addWorksheet("Data Pengajuan", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  data.columns = [
    { header: "No", key: "no", width: 6 },
    { header: "Tanggal Pengajuan (WIB)", key: "tgl", width: 22 },
    { header: "Nama Siswa", key: "nama", width: 28 },
    { header: "NIS", key: "nis", width: 14 },
    { header: "Kelas", key: "kelas", width: 14 },
    { header: "Jenis Izin", key: "jenis", width: 32 },
    { header: "Alasan", key: "alasan", width: 42 },
    { header: "Status", key: "status", width: 20 },
    { header: "Keterangan", key: "ket", width: 38 },
    { header: "Durasi Dispen (menit)", key: "durasi", width: 12 },
    { header: "Mulai Dispen (WIB)", key: "mulai", width: 22 },
    { header: "Kembali (WIB)", key: "kembali", width: 22 },
    { header: "Terlambat (menit)", key: "telat", width: 12 },
  ];
  styleHeaderRow(data, 1);
  d.rows.forEach((r, i) => {
    data.addRow({
      no: i + 1,
      tgl: fmtDT(r.createdAt),
      nama: r.studentName,
      nis: r.nis,
      kelas: r.className,
      jenis: r.izinLabel,
      alasan: r.reason,
      status: r.statusLabel,
      ket: keterangan(r),
      durasi: r.durationMinutes,
      mulai: fmtDT(r.dispenStartedAt),
      kembali: fmtDT(r.returnedAt),
      telat: r.lateMinutes,
    });
  });
  data.getColumn("alasan").alignment = { wrapText: true, vertical: "top" };
  data.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 13 } };

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

// ===========================================================================
// PDF (A4 lanskap)
// ===========================================================================
/** Buang karakter di luar WinAnsi (font standar PDF) agar pdf-lib tidak error. */
const pdfSafe = (t: string) =>
  (t ?? "")
    .replace(/[  ]/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[^\x00-\xff]/g, "");

/** Potong teks agar muat di lebar kolom (diakhiri "..."). */
function fit(text: string, font: PDFFont, size: number, maxW: number): string {
  let t = pdfSafe(text);
  if (font.widthOfTextAtSize(t, size) <= maxW) return t;
  while (t.length > 0 && font.widthOfTextAtSize(`${t}...`, size) > maxW) {
    t = t.slice(0, -1);
  }
  return `${t}...`;
}

const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MARGIN = 36;

export async function buildRekapPdf(
  d: RekapData,
  generatedAt: Date,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Rekap Perizinan ${d.filters.from} s/d ${d.filters.to}`);
  doc.setAuthor("SIPENSI - SMK Telkom Purwokerto");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const brand = rgb(0.86, 0.13, 0.15);
  const ink = rgb(0.1, 0.1, 0.1);
  const muted = rgb(0.42, 0.42, 0.42);
  const rule = rgb(0.85, 0.85, 0.85);
  const zebra = rgb(0.97, 0.97, 0.97);
  const contentW = PAGE_W - MARGIN * 2;

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const text = (t: string, x: number, size: number, f = font, color = ink) =>
    page.drawText(pdfSafe(t), { x, y, size, font: f, color });

  // --- Kop ---
  text("REKAP PERIZINAN SISWA", MARGIN, 16, bold, brand);
  y -= 16;
  text("SIPENSI - Sistem Perizinan Siswa Digital, SMK Telkom Purwokerto", MARGIN, 10, font, muted);
  y -= 14;
  text(
    `Periode: ${d.filters.from} s/d ${d.filters.to}   |   ${d.filterLabel}`,
    MARGIN,
    9,
    font,
    muted,
  );
  y -= 12;
  text(
    `Dibuat: ${fmt.format(generatedAt)} WIB${d.capped ? `   |   Data dibatasi ${d.total} pengajuan terbaru` : ""}`,
    MARGIN,
    9,
    font,
    muted,
  );
  y -= 8;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 1.2,
    color: brand,
  });
  y -= 14;

  // --- Kotak KPI ---
  const kpis: [string, number][] = [
    ["Total pengajuan", d.total],
    ["Disetujui", d.approved],
    ["Ditolak", d.rejected],
    ["Ditolak otomatis", d.autoRejected],
    ["Menunggu", d.pending],
    ["Terlambat kembali", d.lateReturns],
  ];
  const gap = 8;
  const boxW = (contentW - gap * (kpis.length - 1)) / kpis.length;
  kpis.forEach(([label, value], i) => {
    const x = MARGIN + i * (boxW + gap);
    page.drawRectangle({
      x,
      y: y - 42,
      width: boxW,
      height: 42,
      borderColor: rule,
      borderWidth: 0.8,
    });
    page.drawText(String(value), { x: x + 8, y: y - 20, size: 16, font: bold, color: ink });
    page.drawText(pdfSafe(label), { x: x + 8, y: y - 34, size: 8, font, color: muted });
  });
  y -= 62;

  // --- Rincian (3 kolom) ---
  const colGap = 18;
  const colW = (contentW - colGap * 2) / 3;
  const lists: [string, { label: string; value: number }[]][] = [
    ["Per Status", d.byStatus],
    ["Per Jenis Izin", d.byIzin],
    ["Per Kelas (8 teratas)", d.byClass.slice(0, 8)],
  ];
  let tallest = 0;
  lists.forEach(([title, items], i) => {
    const x = MARGIN + i * (colW + colGap);
    page.drawText(title, { x, y, size: 10, font: bold, color: ink });
    items.forEach((it, j) => {
      const yy = y - 14 - j * 12;
      page.drawText(fit(it.label, font, 8.5, colW - 40), { x, y: yy, size: 8.5, font, color: ink });
      const v = String(it.value);
      page.drawText(v, {
        x: x + colW - font.widthOfTextAtSize(v, 8.5),
        y: yy,
        size: 8.5,
        font,
        color: ink,
      });
    });
    tallest = Math.max(tallest, items.length);
  });
  y -= 14 + tallest * 12 + 18;

  // --- Tabel detail ---
  const cols: { h: string; w: number }[] = [
    { h: "No", w: 26 },
    { h: "Tanggal (WIB)", w: 92 },
    { h: "Nama Siswa", w: 130 },
    { h: "NIS", w: 62 },
    { h: "Kelas", w: 62 },
    { h: "Jenis Izin", w: 120 },
    { h: "Status", w: 76 },
  ];
  const usedW = cols.reduce((s, c) => s + c.w, 0);
  cols.push({ h: "Keterangan", w: contentW - usedW });
  const rowH = 14;
  const size = 8;

  const drawTableHeader = () => {
    page.drawRectangle({ x: MARGIN, y: y - 4, width: contentW, height: rowH, color: brand });
    let x = MARGIN;
    for (const c of cols) {
      page.drawText(c.h, { x: x + 3, y, size, font: bold, color: rgb(1, 1, 1) });
      x += c.w;
    }
    y -= rowH;
  };
  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
    drawTableHeader();
  };

  page.drawText(`Daftar Pengajuan (${d.rows.length})`, { x: MARGIN, y, size: 10, font: bold, color: ink });
  y -= 16;
  if (d.rows.length === 0) {
    text("Tidak ada data pada periode/filter ini.", MARGIN, 9, font, muted);
  } else {
    if (y < MARGIN + rowH * 3) newPage();
    else drawTableHeader();
    d.rows.forEach((r, i) => {
      if (y < MARGIN + rowH) newPage();
      if (i % 2 === 1) {
        page.drawRectangle({ x: MARGIN, y: y - 4, width: contentW, height: rowH, color: zebra });
      }
      const cells = [
        String(i + 1),
        fmtDT(r.createdAt),
        r.studentName,
        r.nis,
        r.className,
        r.izinLabel,
        r.statusLabel,
        keterangan(r),
      ];
      let x = MARGIN;
      cells.forEach((c, k) => {
        page.drawText(fit(c, font, size, cols[k].w - 6), { x: x + 3, y, size, font, color: ink });
        x += cols[k].w;
      });
      y -= rowH;
    });
  }

  // --- Nomor halaman ---
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = `Halaman ${i + 1} dari ${pages.length}`;
    p.drawText(label, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(label, 8),
      y: 18,
      size: 8,
      font,
      color: muted,
    });
    p.drawText("SIPENSI - SMK Telkom Purwokerto", { x: MARGIN, y: 18, size: 8, font, color: muted });
  });

  return doc.save();
}
