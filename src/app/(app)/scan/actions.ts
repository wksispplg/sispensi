"use server";

import { requireRole } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { LETTER_TOKEN_PATTERN } from "@/features/surat/qr";
import { readLetterVerification } from "@/features/surat/verification-data";
import type { LetterVerification } from "@/features/surat/verification";

export type ScanResult = { info: LetterVerification; checkedAt: string; error?: never } | { error: string; info?: never; checkedAt?: never };

export async function verifyScannedLetter(token: string): Promise<ScanResult> {
  await requireRole(ROLES.GURU_MAPEL, ROLES.WALI_KELAS, ROLES.GURU_BK, ROLES.ADMIN);
  if (!LETTER_TOKEN_PATTERN.test(token)) return { error: "QR Code bukan surat izin SIPENSI yang valid." };
  try {
    const info = await readLetterVerification(token);
    if (!info) return { error: "Surat tidak ditemukan. QR Code tidak terdaftar di SIPENSI." };
    return { info, checkedAt: new Date().toISOString() };
  } catch {
    return { error: "Data verifikasi belum dapat dihubungi. Periksa koneksi, lalu coba lagi." };
  }
}
