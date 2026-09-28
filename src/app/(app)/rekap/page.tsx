import Link from "next/link";
import { RotateCcw, Search } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import {
  IZIN_TYPE_LABELS,
  REQUEST_STATUS,
  REQUEST_STATUS_LABELS,
  REKAP_PATH,
  ROLES,
  type IzinType,
  type RequestStatus,
} from "@/lib/constants";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];
const WIB_MS = 7 * 3600 * 1000;
const wibDate = (d: Date) => new Date(d.getTime() + WIB_MS).toISOString().slice(0, 10);
const dateFmt = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Rentang default: 30 hari terakhir (WIB). Di luar komponen agar bebas dari aturan purity. */
function defaultRange(): { from: string; to: string } {
  const nowWib = new Date(Date.now() + WIB_MS);
  const to = nowWib.toISOString().slice(0, 10);
  const from = new Date(nowWib.getTime() - 29 * 86400000)
    .toISOString()
    .slice(0, 10);
  return { from, to };
}

type Search = {
  from?: string;
  to?: string;
  kelas?: string;
  jenis?: string;
  q?: string;
};

export default async function RekapPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requireRole(ROLES.GURU_BK, ROLES.ADMIN);
  const sp = await searchParams;

  const { from: fromDefault, to: toDefault } = defaultRange();

  const from = sp.from || fromDefault;
  const to = sp.to || toDefault;
  const kelas = sp.kelas || "";
  const jenis = sp.jenis || "";
  const q = (sp.q || "").trim();

  const admin = createAdminClient();

  // Data master untuk filter.
  const { data: classes } = await admin
    .from("classes")
    .select("id, name")
    .order("name");
  const classMap = new Map((classes ?? []).map((c) => [c.id, c.name] as const));

  // Filter nama siswa -> daftar id.
  let studentFilter: string[] | null = null;
  if (q) {
    const { data: matched } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "siswa")
      .ilike("full_name", `%${q}%`);
    studentFilter = (matched ?? []).map((m) => m.id);
  }

  // Query pengajuan sesuai filter.
  let query = admin
    .from("permission_requests")
    .select(
      "id, student_id, class_id, izin_type, status, current_layer, created_at",
    )
    .gte("created_at", `${from}T00:00:00+07:00`)
    .lte("created_at", `${to}T23:59:59+07:00`);
  if (kelas) query = query.eq("class_id", kelas);
  if (jenis) query = query.eq("izin_type", jenis as IzinType);
  if (studentFilter) {
    query = query.in(
      "student_id",
      studentFilter.length ? studentFilter : ["00000000-0000-0000-0000-000000000000"],
    );
  }
  const { data: reqData } = await query
    .order("created_at", { ascending: false })
    .limit(5000);
  const requests = reqData ?? [];

  // ---- Agregasi ----
  const fromD = new Date(`${from}T00:00:00+07:00`);
  const toD = new Date(`${to}T00:00:00+07:00`);
  const spanDays = Math.round((toD.getTime() - fromD.getTime()) / 86400000) + 1;
  const monthly = spanDays > 31;

  const byStatus = new Map<string, number>();
  const byIzin = new Map<string, number>();
  const byClass = new Map<string, number>();
  const trend = new Map<string, number>();
  let escalatedL3 = 0;

  for (const r of requests) {
    byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
    byIzin.set(r.izin_type, (byIzin.get(r.izin_type) ?? 0) + 1);
    byClass.set(r.class_id ?? "none", (byClass.get(r.class_id ?? "none") ?? 0) + 1);
    if (r.current_layer >= 3) escalatedL3++;
    const key = wibDate(new Date(r.created_at));
    const bucket = monthly ? key.slice(0, 7) : key;
    trend.set(bucket, (trend.get(bucket) ?? 0) + 1);
  }

  // Bucket berurutan untuk grafik tren.
  const trendData: { label: string; value: number }[] = [];
  if (monthly) {
    let [yy, mm] = wibDate(fromD).slice(0, 7).split("-").map(Number);
    const end = wibDate(toD).slice(0, 7);
    while (`${yy}-${String(mm).padStart(2, "0")}` <= end) {
      const key = `${yy}-${String(mm).padStart(2, "0")}`;
      trendData.push({ label: MONTHS[mm - 1], value: trend.get(key) ?? 0 });
      mm += 1;
      if (mm > 12) {
        mm = 1;
        yy += 1;
      }
    }
  } else {
    for (let i = 0; i < spanDays; i++) {
      const key = wibDate(new Date(fromD.getTime() + i * 86400000));
      trendData.push({ label: key.slice(8), value: trend.get(key) ?? 0 });
    }
  }

  const statusColor: Record<string, string> = {
    approved: "bg-emerald-500",
    rejected: "bg-red-500",
    pending: "bg-amber-500",
    cancelled: "bg-zinc-400",
    expired: "bg-zinc-400",
  };
  const statusItems = Object.values(REQUEST_STATUS).map((s) => ({
    label: REQUEST_STATUS_LABELS[s],
    value: byStatus.get(s) ?? 0,
    color: statusColor[s],
  }));
  const izinItems = Object.entries(IZIN_TYPE_LABELS)
    .map(([k, label]) => ({ label, value: byIzin.get(k) ?? 0 }))
    .sort((a, b) => b.value - a.value);
  const classItems = [...byClass.entries()]
    .map(([id, value]) => ({
      label: id === "none" ? "Tanpa kelas" : (classMap.get(id) ?? "—"),
      value,
    }))
    .sort((a, b) => b.value - a.value);

  // Nama siswa untuk tabel (100 baris pertama).
  const tableRows = requests.slice(0, 100);
  const sIds = [...new Set(tableRows.map((r) => r.student_id))];
  const { data: studs } = await admin
    .from("profiles")
    .select("id, full_name, nis")
    .in("id", sIds.length ? sIds : ["00000000-0000-0000-0000-000000000000"]);
  const studentMap = new Map((studs ?? []).map((s) => [s.id, s] as const));

  const total = requests.length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Dashboard Rekapitulasi
        </h1>
        <p className="text-muted-foreground">
          Ringkasan perizinan siswa. Periode {from} s/d {to}.
        </p>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="pt-6">
          <form
            method="get"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="from">Dari</Label>
              <Input id="from" name="from" type="date" defaultValue={from} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="to">Sampai</Label>
              <Input id="to" name="to" type="date" defaultValue={to} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="kelas">Kelas</Label>
              <SelectNative id="kelas" name="kelas" defaultValue={kelas}>
                <option value="">Semua kelas</option>
                {(classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectNative>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="jenis">Jenis izin</Label>
              <SelectNative id="jenis" name="jenis" defaultValue={jenis}>
                <option value="">Semua jenis</option>
                {Object.entries(IZIN_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </SelectNative>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="q">Cari siswa</Label>
              <Input id="q" name="q" defaultValue={q} placeholder="Nama siswa" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                <Search className="size-4" /> Terapkan
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={REKAP_PATH} aria-label="Reset filter">
                  <RotateCcw className="size-4" />
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* KPI */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Stat label="Total Pengajuan" value={total} />
        <Stat
          label="Disetujui"
          value={byStatus.get("approved") ?? 0}
          className="text-emerald-600 dark:text-emerald-400"
        />
        <Stat
          label="Ditolak"
          value={byStatus.get("rejected") ?? 0}
          className="text-red-600 dark:text-red-400"
        />
        <Stat
          label="Menunggu"
          value={byStatus.get("pending") ?? 0}
          className="text-amber-600 dark:text-amber-400"
        />
        <Stat label="Eskalasi Lapis 3" value={escalatedL3} />
      </div>

      {/* Tren */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Tren Pengajuan {monthly ? "Bulanan" : "Harian"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {total === 0 ? (
            <p className="text-muted-foreground text-sm">
              Tidak ada data pada periode ini.
            </p>
          ) : (
            <Trend data={trendData} />
          )}
        </CardContent>
      </Card>

      {/* Breakdown */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per Status</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={statusItems} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per Jenis Izin</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={izinItems} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per Kelas</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={classItems} />
          </CardContent>
        </Card>
      </div>

      {/* Tabel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Daftar Pengajuan{" "}
            <span className="text-muted-foreground font-normal">
              ({total > 100 ? `100 dari ${total}` : total})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tableRows.length === 0 ? (
            <p className="text-muted-foreground text-sm">Tidak ada data.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left">
                    <th className="py-2 pr-3 font-medium">Siswa</th>
                    <th className="py-2 pr-3 font-medium">Kelas</th>
                    <th className="py-2 pr-3 font-medium">Jenis</th>
                    <th className="py-2 pr-3 font-medium">Tanggal</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r) => {
                    const s = studentMap.get(r.student_id);
                    return (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          {s?.full_name ?? "—"}
                          {s?.nis ? (
                            <span className="text-muted-foreground">
                              {" "}
                              · {s.nis}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3">
                          {r.class_id ? (classMap.get(r.class_id) ?? "—") : "—"}
                        </td>
                        <td className="py-2 pr-3">
                          {IZIN_TYPE_LABELS[r.izin_type as IzinType]}
                        </td>
                        <td className="text-muted-foreground py-2 pr-3">
                          {dateFmt.format(new Date(r.created_at))}
                        </td>
                        <td className="py-2">
                          <StatusBadge status={r.status as RequestStatus} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="flex flex-col gap-0.5">
        <span className={cn("text-2xl font-semibold tabular-nums", className)}>
          {value}
        </span>
        <span className="text-muted-foreground text-xs">{label}</span>
      </CardContent>
    </Card>
  );
}

function BarList({
  items,
}: {
  items: { label: string; value: number; color?: string }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.every((i) => i.value === 0)) {
    return <p className="text-muted-foreground text-sm">Tidak ada data.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-sm" title={it.label}>
            {it.label}
          </span>
          <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
            <div
              className={cn("h-full rounded-full", it.color ?? "bg-primary")}
              style={{ width: `${(it.value / max) * 100}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-sm tabular-nums">
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function Trend({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1 overflow-x-auto pb-1">
      {data.map((d, i) => (
        <div key={i} className="flex min-w-[16px] flex-1 flex-col items-center gap-1">
          <div className="flex h-28 w-full items-end justify-center">
            <div
              className="bg-primary/80 w-3.5 rounded-t sm:w-5"
              style={{ height: `${Math.round((d.value / max) * 100)}%` }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
          <span className="text-muted-foreground text-[10px] leading-none">
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}
