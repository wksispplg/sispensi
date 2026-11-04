/** Tahun ajaran dan semester berjalan, mengikuti kalender sekolah Juli–Juni (WIB). */
export function schoolTerm(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", { year: "numeric", month: "numeric", timeZone: "Asia/Jakarta" }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const start = month >= 7 ? year : year - 1;
  return `${start}/${start + 1} · ${month >= 7 ? "Ganjil" : "Genap"}`;
}
