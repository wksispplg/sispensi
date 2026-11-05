import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import QRCode from "qrcode";
import { lessonRangeLabel } from "@/features/izin/lesson-periods";

import { IZIN_TYPES, IZIN_TYPE_LABELS, ROLE_LABELS, type IzinType, type Role } from "@/lib/constants";

export type LetterData = {
  letterNumber: string;
  studentName: string;
  className: string;
  nis: string;
  izinType: IzinType;
  reason: string;
  requestedAt: string;
  issuedAt: string;
  approverName: string;
  approverRole: Role | null;
  decidedAt: string;
  lessonPeriodStart: number | null;
  lessonPeriodEnd: number | null;
  requestedUntil: string | null;
};

const dateOnly = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" });
const dateTime = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" });

// Font surat standar memakai WinAnsi. Normalisasi tanda baca dan karakter kontrol.
function printable(value: string) {
  return value.replace(/[\u2010-\u2015\u2212]/g, "-").replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"').replace(/\u2026/g, "...").replace(/\u2022/g, "-")
    .replace(/[^\x20-\x7e\xa0-\xff\n]/g, " ");
}

export function wrapLetterText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of printable(text).split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) { line = candidate; continue; }
      if (line) { lines.push(line); line = ""; }
      for (const char of word) {
        if (font.widthOfTextAtSize(line + char, size) > maxWidth && line) { lines.push(line); line = ""; }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

/** PDF A4 berisi data persetujuan asli, tanpa bergantung pada cetak browser. */
export async function generateLetterPdf(data: LetterData, verifyUrl: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const entry = data.izinType === IZIN_TYPES.MASUK_KELAS;
  const heading = entry ? "SURAT IZIN MASUK KELAS" : "SURAT IZIN SISWA";
  doc.setTitle(`Surat Izin ${entry ? "Masuk Kelas" : "Dispensasi"} - ${data.letterNumber}`);
  doc.setAuthor("SMK Telkom Purwokerto");
  doc.setSubject("Persetujuan izin siswa melalui SIPENSI");
  doc.setCreator("SIPENSI");
  const regular = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const logoBytes = await readFile(path.join(process.cwd(), "public", "branding", "telkom-schools.png"));
  const logo = await doc.embedPng(logoBytes);
  const qr = await doc.embedPng(await QRCode.toBuffer(verifyUrl, { width: 600, margin: 4, errorCorrectionLevel: "M" }));
  const width = 595.28;
  const height = 841.89;
  const margin = 48;
  const contentWidth = width - 2 * margin;
  const ink = rgb(0.1, 0.1, 0.1);
  const muted = rgb(0.38, 0.38, 0.38);
  let page = doc.addPage([width, height]);
  let y = 0;

  const text = (value: string, x: number, at: number, size = 11, font = regular) => {
    page.drawText(printable(value), { x, y: at, size, font, color: ink });
  };
  const centered = (value: string, at: number, size: number, font: PDFFont, left = margin, available = contentWidth) => {
    const safe = printable(value);
    text(safe, left + (available - font.widthOfTextAtSize(safe, size)) / 2, at, size, font);
  };

  function header(continuation = false) {
    const image = logo.scaleToFit(66, 68);
    page.drawImage(logo, { x: margin + 4, y: 750, ...image });
    const left = margin + 85;
    const available = contentWidth - 85;
    centered("YAYASAN PENDIDIKAN TELKOM", 798, 10.5, bold, left, available);
    centered("SMK TELKOM PURWOKERTO", 777, 17, bold, left, available);
    centered("Jl. D. I. Panjaitan No. 128, Purwokerto", 759, 10, regular, left, available);
    centered("Website: smktelkom-pwt.sch.id | Telp. (0281) 632138", 744, 9, regular, left, available);
    page.drawLine({ start: { x: margin, y: 730 }, end: { x: width - margin, y: 730 }, thickness: 1.6, color: ink });
    page.drawLine({ start: { x: margin, y: 726 }, end: { x: width - margin, y: 726 }, thickness: 0.5, color: ink });
    centered(heading, 696, 14, bold);
    const titleWidth = bold.widthOfTextAtSize(heading, 14);
    page.drawLine({ start: { x: (width - titleWidth) / 2, y: 692 }, end: { x: (width + titleWidth) / 2, y: 692 }, thickness: 0.6, color: ink });
    centered(`Nomor: ${data.letterNumber}`, 675, 10.5, regular);
    if (continuation) centered("(Lanjutan)", 656, 10, regular);
    y = continuation ? 632 : 638;
  }

  function needSpace(amount: number) {
    if (y - amount >= 80) return;
    page = doc.addPage([width, height]);
    header(true);
  }

  function paragraph(value: string, after = 12) {
    for (const line of wrapLetterText(value, regular, 11, contentWidth)) {
      needSpace(15);
      text(line, margin, y);
      y -= 15;
    }
    y -= after;
  }

  function row(label: string, value: string) {
    const valueX = margin + 112;
    const lines = wrapLetterText(value, regular, 11, width - margin - valueX);
    needSpace(lines.length * 15 + 7);
    text(label, margin + 8, y);
    text(":", valueX - 12, y);
    for (const line of lines) { text(line, valueX, y); y -= 15; }
    y -= 7;
  }

  header();
  paragraph(entry ? "Diberikan izin masuk kelas kepada:" : "Diberikan izin kepada:", 14);
  row("Nama siswa", data.studentName);
  row("NIS", data.nis || "-");
  row("Kelas", data.className);
  row("Jenis izin", IZIN_TYPE_LABELS[data.izinType]);
  const range = lessonRangeLabel(data.lessonPeriodStart, data.lessonPeriodEnd);
  if (range) {
    row("Tanggal", dateOnly.format(new Date(data.requestedAt)));
    row("Jam pelajaran", range);
  } else {
    row("Waktu izin", `${dateTime.format(new Date(data.requestedAt))} WIB`);
  }
  needSpace(44);
  text("Keperluan:", margin + 8, y, 11, bold);
  y -= 19;
  paragraph(data.reason, 14);

  const closing = "Demikian surat ini dibuat untuk digunakan sebagaimana mestinya.";
  const signatureX = 320;
  const signatureWidth = width - margin - signatureX;
  const names = wrapLetterText(data.approverName, bold, 11, signatureWidth);
  const role = data.approverRole ? ROLE_LABELS[data.approverRole] : "Guru penanggung jawab";
  const roles = wrapLetterText(role, regular, 10, signatureWidth);
  const approvalHeight = Math.max(132, 90 + 14 * names.length + 13 * roles.length);
  needSpace(wrapLetterText(closing, regular, 11, contentWidth).length * 15 + 10 + 12 + approvalHeight);
  paragraph(closing, 10);
  const approvalTop = Math.min(y - 12, Math.max(224, 80 + approvalHeight));
  const qrSize = 108;
  const qrX = margin + 12;
  const qrY = approvalTop - qrSize;
  page.drawImage(qr, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  centered("Verifikasi surat", qrY - 12, 9, regular, margin, 132);

  centered(`Purwokerto, ${dateOnly.format(new Date(data.issuedAt))}`, approvalTop - 8, 10.5, regular, signatureX, signatureWidth);
  centered("Disetujui oleh,", approvalTop - 26, 10.5, regular, signatureX, signatureWidth);
  let nameY = approvalTop - 66;
  for (const name of names) {
    centered(name, nameY, 11, bold, signatureX, signatureWidth);
    nameY -= 14;
  }
  for (const line of roles) {
    centered(line, nameY - 3, 10, regular, signatureX, signatureWidth);
    nameY -= 13;
  }
  centered(`${dateTime.format(new Date(data.decidedAt))} WIB`, nameY - 8, 8, regular, signatureX, signatureWidth);

  const pages = doc.getPages();
  pages.forEach((sheet, index) => {
    sheet.drawLine({ start: { x: margin, y: 58 }, end: { x: width - margin, y: 58 }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75) });
    sheet.drawText("SIPENSI | SMK Telkom Purwokerto", { x: margin, y: 42, size: 8, font: sans, color: muted });
    const number = `${index + 1} / ${pages.length}`;
    sheet.drawText(number, { x: width - margin - sans.widthOfTextAtSize(number, 8), y: 42, size: 8, font: sans, color: muted });
  });
  return doc.save();
}
