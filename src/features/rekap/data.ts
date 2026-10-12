/**
 * Data rekapitulasi perizinan — satu sumber untuk halaman /rekap dan ekspor
 * PDF/Excel, agar angka di layar dan di file selalu sama.
 *
 * Memakai service role (bypass RLS): pemanggil WAJIB sudah memastikan pengguna
 * adalah Guru BK / Admin.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import {
  IZIN_TYPE_LABELS,
  IZIN_TYPES,
  REQUEST_STATUS,
  REQUEST_STATUS_LABELS,
  type IzinType,
  type RequestStatus,
} from "@/lib/constants";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];
const WIB_MS = 7 * 3600 * 1000;
const NO_MATCH = "00000000-0000-0000-0000-000000000000";
/** Batas baris yang diambil dari database per rekap. */
export const REKAP_MAX_ROWS = 5000;

const wibDate = (d: Date) =>
  new Date(d.getTime() + WIB_MS).toISOString().slice(0, 10);

/** Format tanggal-jam WIB, eksplisit Asia/Jakarta (tak bergantung zona server). */
export const wibDateTime = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

export type RekapFilters = {
  from: string;
  to: string;
  kelas: string;
  jenis: string;
  q: string;
};

/** Rentang default: 30 hari terakhir (WIB). */
function defaultRange(): { from: string; to: string } {
  const nowWib = new Date(Date.now() + WIB_MS);
  const to = nowWib.toISOString().slice(0, 10);
  const from = new Date(nowWib.getTime() - 29 * 86400000)
    .toISOString()
    .slice(0, 10);
  return { from, to };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validasi & normalisasi filter dari query string (nilai tak valid diabaikan). */
export function parseRekapFilters(
  sp: Record<string, string | undefined>,
): RekapFilters {
  const d = defaultRange();
  const jenis = sp.jenis ?? "";
  return {
    from: sp.from && DATE_RE.test(sp.from) ? sp.from : d.from,
    to: sp.to && DATE_RE.test(sp.to) ? sp.to : d.to,
    kelas: sp.kelas && UUID_RE.test(sp.kelas) ? sp.kelas : "",
    jenis: (Object.values(IZIN_TYPES) as string[]).includes(jenis) ? jenis : "",
    q: (sp.q ?? "").trim().slice(0, 100),
  };
}

/** Query string untuk filter (dipakai tautan ekspor). */
export function rekapQueryString(f: RekapFilters): string {
  const p = new URLSearchParams({ from: f.from, to: f.to });
  if (f.kelas) p.set("kelas", f.kelas);
  if (f.jenis) p.set("jenis", f.jenis);
  if (f.q) p.set("q", f.q);
  return p.toString();
}

export type RekapRow = {
  id: string;
  createdAt: string;
  studentName: string;
  nis: string;
  className: string;
  izinType: IzinType;
  izinLabel: string;
  status: RequestStatus;
  statusLabel: string;
  reason: string;
  layer: number;
  /** Ditolak oleh sistem karena tidak ditanggapi > 1 hari. */
  autoRejected: boolean;
  durationMinutes: number | null;
  dispenStartedAt: string | null;
  returnedAt: string | null;
  /** Menit terlambat kembali (0 = tepat waktu, null = bukan dispen berjalan). */
  lateMinutes: number | null;
};

export type CountItem = { key: string; label: string; value: number };

export type RekapData = {
  filters: RekapFilters;
  classes: { id: string; name: string }[];
  /** Label filter yang manusiawi, untuk judul file/laporan. */
  filterLabel: string;
  total: number;
  /** True bila data mencapai batas REKAP_MAX_ROWS. */
  capped: boolean;
  approved: number;
  rejected: number;
  autoRejected: number;
  pending: number;
  escalatedL3: number;
  lateReturns: number;
  monthly: boolean;
  trend: { label: string; value: number }[];
  byStatus: CountItem[];
  byIzin: CountItem[];
  byClass: CountItem[];
  /** Baris detail (dibatasi `rowLimit`), urut terbaru dulu. */
  rows: RekapRow[];
};

function lateMinutes(
  startedAt: string | null,
  deadline: string | null,
  returnedAt: string | null,
  nowMs: number,
): number | null {
  if (!startedAt || !deadline) return null;
  const end = returnedAt ? new Date(returnedAt).getTime() : nowMs;
  const lateMs = end - new Date(deadline).getTime();
  // Dibulatkan ke ATAS agar konsisten dengan layar pemantauan, yang menandai
  // "Terlambat" begitu batas waktu lewat (terlambat 30 detik = 1 menit).
  return lateMs > 0 ? Math.ceil(lateMs / 60000) : 0;
}

export async function loadRekap(
  f: RekapFilters,
  opts: { rowLimit?: number; nowMs?: number } = {},
): Promise<RekapData> {
  const rowLimit = opts.rowLimit ?? REKAP_MAX_ROWS;
  const nowMs = opts.nowMs ?? Date.now();
  const admin = createAdminClient();

  const { data: classes } = await admin
    .from("classes")
    .select("id, name")
    .order("name");
  const classMap = new Map((classes ?? []).map((c) => [c.id, c.name] as const));

  // Filter nama siswa -> daftar id.
  let studentFilter: string[] | null = null;
  if (f.q) {
    const { data: matched } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "siswa")
      .ilike("full_name", `%${f.q}%`);
    studentFilter = (matched ?? []).map((m) => m.id);
  }

  let query = admin
    .from("permission_requests")
    .select(
      "id, student_id, class_id, izin_type, status, current_layer, created_at, reason, decided_by, duration_minutes, dispen_started_at, dispen_deadline, returned_at",
    )
    .gte("created_at", `${f.from}T00:00:00+07:00`)
    .lte("created_at", `${f.to}T23:59:59+07:00`);
  if (f.kelas) query = query.eq("class_id", f.kelas);
  if (f.jenis) query = query.eq("izin_type", f.jenis as IzinType);
  if (studentFilter) {
    query = query.in(
      "student_id",
      studentFilter.length ? studentFilter : [NO_MATCH],
    );
  }
  const { data: reqData } = await query
    .order("created_at", { ascending: false })
    .limit(REKAP_MAX_ROWS);
  const requests = reqData ?? [];

  // ---- Agregasi ----
  const fromD = new Date(`${f.from}T00:00:00+07:00`);
  const toD = new Date(`${f.to}T00:00:00+07:00`);
  const spanDays = Math.round((toD.getTime() - fromD.getTime()) / 86400000) + 1;
  const monthly = spanDays > 31;

  const statusCount = new Map<string, number>();
  const izinCount = new Map<string, number>();
  const classCount = new Map<string, number>();
  const trendCount = new Map<string, number>();
  let escalatedL3 = 0;
  let autoRejected = 0;
  let lateReturns = 0;

  for (const r of requests) {
    statusCount.set(r.status, (statusCount.get(r.status) ?? 0) + 1);
    izinCount.set(r.izin_type, (izinCount.get(r.izin_type) ?? 0) + 1);
    const ck = r.class_id ?? "none";
    classCount.set(ck, (classCount.get(ck) ?? 0) + 1);
    if (r.current_layer >= 3) escalatedL3++;
    if (r.status === REQUEST_STATUS.REJECTED && !r.decided_by) autoRejected++;
    const late = lateMinutes(
      r.dispen_started_at,
      r.dispen_deadline,
      r.returned_at,
      nowMs,
    );
    if (late && late > 0) lateReturns++;
    const key = wibDate(new Date(r.created_at));
    const bucket = monthly ? key.slice(0, 7) : key;
    trendCount.set(bucket, (trendCount.get(bucket) ?? 0) + 1);
  }

  // Bucket tren berurutan (harian ≤ 31 hari, selebihnya bulanan).
  const trend: { label: string; value: number }[] = [];
  if (monthly) {
    let [yy, mm] = wibDate(fromD).slice(0, 7).split("-").map(Number);
    const end = wibDate(toD).slice(0, 7);
    while (`${yy}-${String(mm).padStart(2, "0")}` <= end) {
      const key = `${yy}-${String(mm).padStart(2, "0")}`;
      trend.push({ label: `${MONTHS[mm - 1]} ${yy}`, value: trendCount.get(key) ?? 0 });
      mm += 1;
      if (mm > 12) {
        mm = 1;
        yy += 1;
      }
    }
  } else {
    for (let i = 0; i < spanDays; i++) {
      const key = wibDate(new Date(fromD.getTime() + i * 86400000));
      trend.push({ label: key, value: trendCount.get(key) ?? 0 });
    }
  }

  const byStatus = Object.values(REQUEST_STATUS).map((s) => ({
    key: s,
    label: REQUEST_STATUS_LABELS[s],
    value: statusCount.get(s) ?? 0,
  }));
  const byIzin = Object.entries(IZIN_TYPE_LABELS)
    .map(([k, label]) => ({ key: k, label, value: izinCount.get(k) ?? 0 }))
    .sort((a, b) => b.value - a.value);
  const byClass = [...classCount.entries()]
    .map(([id, value]) => ({
      key: id,
      label: id === "none" ? "Tanpa kelas" : (classMap.get(id) ?? "—"),
      value,
    }))
    .sort((a, b) => b.value - a.value);

  // ---- Baris detail + nama siswa (diambil per 200 id agar URL tidak kepanjangan) ----
  const slice = requests.slice(0, rowLimit);
  const ids = [...new Set(slice.map((r) => r.student_id))];
  const studentMap = new Map<string, { full_name: string | null; nis: string | null }>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: studs } = await admin
      .from("profiles")
      .select("id, full_name, nis")
      .in("id", ids.slice(i, i + 200));
    for (const s of studs ?? []) studentMap.set(s.id, s);
  }

  const rows: RekapRow[] = slice.map((r) => {
    const s = studentMap.get(r.student_id);
    const status = r.status as RequestStatus;
    return {
      id: r.id,
      createdAt: r.created_at,
      studentName: s?.full_name ?? "—",
      nis: s?.nis ?? "",
      className: r.class_id ? (classMap.get(r.class_id) ?? "—") : "Tanpa kelas",
      izinType: r.izin_type as IzinType,
      izinLabel: IZIN_TYPE_LABELS[r.izin_type as IzinType],
      status,
      statusLabel: REQUEST_STATUS_LABELS[status],
      reason: r.reason,
      layer: r.current_layer,
      autoRejected: status === REQUEST_STATUS.REJECTED && !r.decided_by,
      durationMinutes: r.duration_minutes,
      dispenStartedAt: r.dispen_started_at,
      returnedAt: r.returned_at,
      lateMinutes: lateMinutes(
        r.dispen_started_at,
        r.dispen_deadline,
        r.returned_at,
        nowMs,
      ),
    };
  });

  const filterParts = [
    f.kelas ? `Kelas ${classMap.get(f.kelas) ?? "—"}` : "Semua kelas",
    f.jenis ? IZIN_TYPE_LABELS[f.jenis as IzinType] : "Semua jenis izin",
  ];
  if (f.q) filterParts.push(`Nama siswa mengandung "${f.q}"`);

  return {
    filters: f,
    classes: classes ?? [],
    filterLabel: filterParts.join(" · "),
    total: requests.length,
    capped: requests.length >= REKAP_MAX_ROWS,
    approved: statusCount.get(REQUEST_STATUS.APPROVED) ?? 0,
    rejected: statusCount.get(REQUEST_STATUS.REJECTED) ?? 0,
    autoRejected,
    pending: statusCount.get(REQUEST_STATUS.PENDING) ?? 0,
    escalatedL3,
    lateReturns,
    monthly,
    trend,
    byStatus,
    byIzin,
    byClass,
    rows,
  };
}
