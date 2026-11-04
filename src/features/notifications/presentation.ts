export type StudentNotification = {
  id: string;
  title: string | null;
  message: string;
  request_id: string | null;
  created_at: string;
  is_read: boolean;
};

export function notificationKind(item: StudentNotification): "letter" | "approved" | "rejected" | "pending" {
  const title = (item.title ?? "").toLowerCase();
  if (/surat|pdf|qr/.test(title)) return "letter";
  if (/ditolak|dibatalkan|kedaluwarsa/.test(title)) return "rejected";
  if (/disetujui/.test(title)) return "approved";
  return "pending";
}

const wibDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Jakarta" });
export function notificationGroup(createdAt: string, now: number): "Hari ini" | "Kemarin" | "Sebelumnya" {
  const today = Date.parse(`${wibDay.format(new Date(now))}T00:00:00Z`);
  const date = Date.parse(`${wibDay.format(new Date(createdAt))}T00:00:00Z`);
  if (date >= today) return "Hari ini";
  return today - date === 86400000 ? "Kemarin" : "Sebelumnya";
}
