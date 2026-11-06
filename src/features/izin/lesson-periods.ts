import { LESSON_PERIODS } from "@/lib/constants";

export const DISPENSATION_PERIOD_ENDED = "Jam mulai sudah berakhir. Pilih jam yang masih berlangsung atau belum dimulai.";
export const LESSON_PERIOD_UNAVAILABLE = "Pilih jam pelajaran yang tersedia hari ini.";

const DEMO_DATE = "2026-11-06";
export const DEMO_LESSON_PERIOD = { number: 13, start: "16:00", end: "23:59" } as const;
const DEMO_DAY_PERIODS = [...LESSON_PERIODS, DEMO_LESSON_PERIOD] as const;

const wibClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const wibDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });

function schoolDate(now: Date) {
  const parts = wibDate.formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function periodsForDate(date: string) {
  return date === DEMO_DATE ? DEMO_DAY_PERIODS : LESSON_PERIODS;
}

export function lessonPeriodsToday(now = new Date()) {
  return periodsForDate(schoolDate(now));
}

export function firstAvailableLessonPeriod(now = new Date()) {
  const time = wibClock.format(now);
  const periods = lessonPeriodsToday(now);
  return periods.find((period) => time < period.end)?.number ?? periods[periods.length - 1].number + 1;
}

export function getLessonPeriod(number: number) {
  return LESSON_PERIODS.find((period) => period.number === number);
}

/** Tanggal hari ini di WIB, bukan zona waktu laptop/browser atau server hosting. */
export function lessonRequestTime(periodNumber: number, now = new Date()) {
  const date = schoolDate(now);
  const period = periodsForDate(date).find((item) => item.number === periodNumber);
  if (!period) throw new Error(LESSON_PERIOD_UNAVAILABLE);
  const requestedAt = new Date(`${date}T${period.start}:00+07:00`).toISOString();
  const day = new Date(`${date}T12:00:00+07:00`).getUTCDay() || 7;
  return { period, requestedAt, day, time: `${period.start}:00`, date };
}

export function lessonPeriodLabel(number: number) {
  const period = DEMO_DAY_PERIODS.find((item) => item.number === number);
  return period ? `Jam ke-${period.number} · ${period.start.replace(":", ".")}–${period.end.replace(":", ".")} WIB` : "Belum dipilih";
}

export function lessonRangeLabel(start: number | null | undefined, end: number | null | undefined): string | null {
  const first = DEMO_DAY_PERIODS.find((item) => item.number === start);
  const last = DEMO_DAY_PERIODS.find((item) => item.number === end);
  if (!first || !last || first.number > last.number) return null;
  const numbers = first.number === last.number ? `Jam ke-${first.number}` : `Jam ke-${first.number} s.d. ke-${last.number}`;
  return `${numbers} (${first.start.replace(":", ".")}–${last.end.replace(":", ".")} WIB)`;
}

export function lessonRangeTime(start: number, end: number, now = new Date()) {
  const first = lessonRequestTime(start, now);
  const last = periodsForDate(first.date).find((period) => period.number === end);
  if (!last || start > end) throw new Error("Jam pelajaran akhir tidak boleh sebelum jam awal.");
  return { ...first, requestedUntil: new Date(`${first.date}T${last.end}:00+07:00`).toISOString() };
}
