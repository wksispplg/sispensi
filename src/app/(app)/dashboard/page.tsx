import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  DASHBOARD_PATH,
  IZIN_TYPE_LABELS,
  REQUEST_STATUS,
  ROLE_LABELS,
  ROLES,
  type IzinType,
} from "@/lib/constants";
import { dispenPhase } from "@/features/dispen/phase";
import { navItemsForRole } from "@/lib/navigation";
import { DispenControls } from "@/features/dispen/dispen-controls";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HomeWelcome } from "./home-welcome";

export default async function DashboardPage() {
  const profile = await getProfile();
  if (!profile) return null; // ditangani oleh (app)/layout.tsx

  const firstName =
    (profile.full_name ?? "").trim().split(/\s+/)[0] || "Pengguna";
  const fullName = profile.full_name?.trim() || "Pengguna";
  // Tile = menu navigasi peran ini, tanpa "Beranda".
  const tiles = navItemsForRole(profile.role).filter(
    (i) => i.href !== DASHBOARD_PATH,
  );

  return (
    <div className="flex flex-col gap-6">
      <HomeWelcome name={fullName} identifier={profile.nis?.trim() || firstName} />

      <div className="lg:hidden">
        <h1 className="text-2xl font-semibold tracking-tight">
          Halo, {firstName} 👋
        </h1>
        <p className="text-muted-foreground">
          Anda masuk sebagai{" "}
          <span className="text-foreground font-medium">
            {ROLE_LABELS[profile.role]}
          </span>
          .
        </p>
      </div>

      {profile.role === ROLES.SISWA ? (
        <ActiveDispenCard studentId={profile.id} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
        {tiles.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="group block">
              <Card className="group-hover:border-primary/40 h-full gap-3 py-5 transition-colors">
                <CardHeader className="gap-2">
                  <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Kartu "Dispen aktif" untuk siswa: hitung mundur + tombol "Kembali ke Sekolah"
 * langsung di beranda, atau tombol "Mulai Dispen" bila izin baru disetujui.
 * Tidak tampil bila tidak ada izin ber-timer yang sedang/siap berjalan.
 */
async function ActiveDispenCard({ studentId }: { studentId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("permission_requests")
    .select(
      "id, izin_type, status, duration_minutes, dispen_started_at, dispen_deadline, returned_at",
    )
    .eq("student_id", studentId)
    .eq("status", REQUEST_STATUS.APPROVED)
    .not("duration_minutes", "is", null)
    .is("returned_at", null)
    .order("created_at", { ascending: false })
    .limit(5);

  const withPhase = (data ?? []).map((r) => ({ r, phase: dispenPhase(r) }));
  // Prioritaskan yang sedang berjalan/terlambat, baru yang siap dimulai.
  const current =
    withPhase.find((x) => x.phase === "active" || x.phase === "overdue") ??
    withPhase.find((x) => x.phase === "ready");
  if (!current) return null;

  const { r, phase } = current;
  const running = phase === "active" || phase === "overdue";

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">
            {running ? "Dispen sedang berjalan" : "Izin siap digunakan"}
          </CardTitle>
          <CardDescription>
            {IZIN_TYPE_LABELS[r.izin_type as IzinType]} · {r.duration_minutes}{" "}
            menit
          </CardDescription>
        </div>
        <Link
          href={`/izin/${r.id}`}
          className="text-primary inline-flex shrink-0 items-center gap-0.5 text-sm font-medium hover:underline"
        >
          Detail <ChevronRight className="size-4" aria-hidden />
        </Link>
      </CardHeader>
      <CardContent>
        <DispenControls
          id={r.id}
          phase={phase}
          durationMinutes={r.duration_minutes}
          dispenDeadline={r.dispen_deadline}
          returnedAt={r.returned_at}
        />
      </CardContent>
    </Card>
  );
}
