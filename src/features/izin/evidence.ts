import { EVIDENCE_MAX_BYTES, EVIDENCE_MIME_TYPES } from "@/lib/constants";

export function evidenceError(size: number | undefined, contentType: string | undefined) {
  if (!size || size < 0) return "Bukti pendukung wajib dilampirkan.";
  if (size > EVIDENCE_MAX_BYTES) return "Ukuran bukti maksimal 5 MB.";
  if (!contentType || !EVIDENCE_MIME_TYPES.includes(contentType)) {
    return "Bukti harus berupa gambar (JPG/PNG/WebP) atau PDF.";
  }
  return null;
}

export function createEvidencePath(studentId: string, contentType: string) {
  // getRandomValues juga tersedia saat membuka aplikasi lewat IP lokal dari HP.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const id = [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
  const extension = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
  return `${studentId}/${id}.${extension}`;
}
