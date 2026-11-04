import { REQUEST_STATUS, REQUEST_STATUS_LABELS, type IzinType, type RequestStatus } from "@/lib/constants";

export type LetterVerification = {
  letterNumber: string | null;
  studentName: string;
  className: string;
  izinType: IzinType;
  status: RequestStatus;
  requestedAt: string;
  requestedUntil: string | null;
  lessonPeriodStart: number | null;
  lessonPeriodEnd: number | null;
  issuedAt: string;
  decidedAt: string | null;
};

export type VerificationState = { tone: "success" | "warning" | "danger"; title: string; description: string };

export function verificationState(info: LetterVerification, now = Date.now()): VerificationState {
  if (info.status !== REQUEST_STATUS.APPROVED) return { tone: "danger", title: "Surat izin tidak berlaku", description: `Status pengajuan: ${REQUEST_STATUS_LABELS[info.status]}.` };
  if (info.requestedUntil && new Date(info.requestedUntil).getTime() < now) return { tone: "warning", title: "Waktu izin telah berakhir", description: "Pengajuan tercatat disetujui, tetapi rentang waktu pada surat sudah lewat." };
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
  if (!info.requestedUntil && day.format(new Date(info.requestedAt)) < day.format(new Date(now))) return { tone: "warning", title: "Tanggal izin sudah lewat", description: "Cocokkan tanggal pada surat dengan tanggal penggunaan izin." };
  if (new Date(info.requestedAt).getTime() > now) return { tone: "warning", title: "Jadwal izin belum dimulai", description: "Pengajuan disetujui untuk rentang waktu yang tercantum pada surat." };
  return { tone: "success", title: "Izin disetujui", description: "Surat terdaftar di SIPENSI. Cocokkan nama siswa, kelas, dan jam pelajaran." };
}
