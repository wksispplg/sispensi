import Link from "next/link";
import { FileSpreadsheet, FileText, RotateCcw, Search } from "lucide-react";

import { requireRole } from "@/lib/auth";
import { IZIN_TYPE_LABELS, REKAP_PATH, ROLES } from "@/lib/constants";
import {
  REKAP_MAX_ROWS,
  loadRekap,
  parseRekapFilters,
  rekapQueryString,
  wibDateTime,
} from "@/features/rekap/data";
import { StatusBadge } from "@/features/izin/status-badge";
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

/** Jumlah baris yang ditampilkan di tabel halaman (ekspor memuat semuanya). */
const TABLE_ROWS = 100;

const STATUS_COLOR: Record<string, string> = {
  approved: "bg-emerald-500",
  rejected: "bg-red-500",
  pending: "bg-amber-500",
  cancelled: "bg-zinc-400",
  expired: "bg-zinc-400",
};

export default async function RekapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole(ROLES.GURU_BK, ROLES.ADMIN);
  const filters = parseRekapFilters(await searchParams);
  const { from, to, kelas, jenis, q } = filters;

  const data = await loadRekap(filters, { rowLimit: TABLE_ROWS });
  const exportQs = rekapQueryString(filters);

  const statusItems = data.byStatus.map((s) => ({
    label: s.label,
    value: s.value,
    color: STATUS_COLOR[s.key],
  }));
  // Label pendek di bawah batang grafik: tanggal (harian) / nama bulan (bulanan).
  const trendData = data.trend.map((t) => ({
    label: data.monthly ? t.label.split(" ")[0] : t.label.slice(8),
    value: t.value,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Dashboard Rekapitulasi
          </h1>
          <p className="text-muted-foreground">
            Ringkasan perizinan siswa. Periode {from} s/d {to}.
          </p>
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <div className="flex gap-2">
            <Button variant="outline" asChild className="flex-1 sm:flex-none">
              <a href={`${REKAP_PATH}/export?format=xlsx&${exportQs}`}>
                <FileSpreadsheet className="size-4" aria-hidden /> Unduh Excel
              </a>
            </Button>
            <Button variant="outline" asChild className="flex-1 sm:flex-none">
              <a href={`${REKAP_PATH}/export?format=pdf&${exportQs}`}>
                <FileText className="size-4" aria-hidden /> Unduh PDF
              </a>
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Sesuai filter yang diterapkan · maks.{" "}
            {REKAP_MAX_ROWS.toLocaleString("id-ID")} pengajuan
          </p>
        </div>
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
                {data.classes.map((c) => (
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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total Pengajuan" value={data.total} />
        <Stat
          label="Disetujui"
          value={data.approved}
          className="text-emerald-600 dark:text-emerald-400"
        />
        <Stat
          label={
            data.autoRejected
              ? `Ditolak (${data.autoRejected} otomatis)`
              : "Ditolak"
          }
          value={data.rejected}
          className="text-red-600 dark:text-red-400"
        />
        <Stat
          label="Menunggu"
          value={data.pending}
          className="text-amber-600 dark:text-amber-400"
        />
        <Stat label="Eskalasi Lapis 3" value={data.escalatedL3} />
        <Stat label="Terlambat Kembali" value={data.lateReturns} />
      </div>

      {/* Tren */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Tren Pengajuan {data.monthly ? "Bulanan" : "Harian"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.total === 0 ? (
            <p className="text-muted-foreground text-sm">
              Tidak ada data pada periode ini.
            </p>
          ) : (
            <Trend data={trendData} />
          )}
        </CardContent>
      </Card>

      {/* Rincian */}
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
            <BarList items={data.byIzin} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per Kelas</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={data.byClass} />
          </CardContent>
        </Card>
      </div>

      {/* Tabel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Daftar Pengajuan{" "}
            <span className="text-muted-foreground font-normal">
              (
              {data.total > TABLE_ROWS
                ? `${TABLE_ROWS} dari ${data.total} — unduh Excel/PDF untuk semua`
                : data.total}
              )
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.rows.length === 0 ? (
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
                  {data.rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        {r.studentName}
                        {r.nis ? (
                          <span className="text-muted-foreground"> · {r.nis}</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3">{r.className}</td>
                      <td className="py-2 pr-3">{r.izinLabel}</td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {wibDateTime.format(new Date(r.createdAt))}
                      </td>
                      <td className="py-2">
                        <StatusBadge status={r.status} />
                        {r.autoRejected ? (
                          <span className="text-muted-foreground ml-1 text-xs">
                            otomatis
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
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
