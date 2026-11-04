import { LESSON_PERIODS } from "@/lib/constants";

export function getLessonPeriod(number: number) {
  return LESSON_PERIODS.find((period) => period.number === number);
}

/** Tanggal hari ini di WIB, bukan zona waktu laptop/browser atau server hosting. */
export function lessonRequestTime(periodNumber: number, now = new Date()) {
  const period = getLessonPeriod(periodNumber);
  if (!period) throw new Error("Pilih jam pelajaran 1 sampai 11.");
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  const requestedAt = new Date(`${date}T${period.start}:00+07:00`).toISOString();
  const day = new Date(`${date}T12:00:00+07:00`).getUTCDay() || 7;
  return { period, requestedAt, day, time: `${period.start}:00`, date };
}

export function lessonPeriodLabel(number: number) {
  const period = getLessonPeriod(number);
  return period ? `Jam ke-${period.number} · ${period.start.replace(":", ".")}–${period.end.replace(":", ".")} WIB` : "Belum dipilih";
}

export function lessonRangeLabel(start: number | null | undefined, end: number | null | undefined): string | null {
  const first = getLessonPeriod(start ?? 0);
  const last = getLessonPeriod(end ?? 0);
  if (!first || !last || first.number > last.number) return null;
  const numbers = first.number === last.number ? `Jam ke-${first.number}` : `Jam ke-${first.number} s.d. ke-${last.number}`;
  return `${numbers} (${first.start.replace(":", ".")}–${last.end.replace(":", ".")} WIB)`;
}

export function lessonRangeTime(start: number, end: number, now = new Date()) {
  const first = lessonRequestTime(start, now);
  const last = getLessonPeriod(end);
  if (!last || start > end) throw new Error("Jam pelajaran akhir tidak boleh sebelum jam awal.");
  return { ...first, requestedUntil: new Date(`${first.date}T${last.end}:00+07:00`).toISOString() };
}
