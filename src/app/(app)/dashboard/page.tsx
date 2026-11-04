import Link from "next/link";

import { getProfile } from "@/lib/auth";
import { DASHBOARD_PATH, ROLE_LABELS, ROLES } from "@/lib/constants";
import { navItemsForRole } from "@/lib/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { HomeWelcome } from "./home-welcome";
import { getStudentDashboard } from "@/features/izin/student-data";
import { StudentDashboard } from "./student-dashboard";

export default async function DashboardPage() {
  const profile = await getProfile();
  if (!profile) return null;
  if (profile.role === ROLES.SISWA) {
    const data = await getStudentDashboard(profile.id);
    return <StudentDashboard profile={profile} {...data} />;
  }
  const firstName = (profile.full_name ?? "").trim().split(/\s+/)[0] || "Pengguna";
  const fullName = profile.full_name?.trim() || "Pengguna";
  const tiles = navItemsForRole(profile.role).filter((item) => item.href !== DASHBOARD_PATH);
  return (
    <div className="flex flex-col gap-6">
      <HomeWelcome name={fullName} identifier={profile.nis?.trim() || firstName} />
      <div className="lg:hidden">
        <h1 className="text-2xl font-semibold tracking-tight">Halo, {firstName} 👋</h1>
        <p className="text-muted-foreground">Anda masuk sebagai <span className="text-foreground font-medium">{ROLE_LABELS[profile.role]}</span>.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
        {tiles.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="group block">
              <Card className="group-hover:border-primary/40 h-full gap-3 py-5 transition-colors">
                <CardHeader className="gap-2">
                  <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg"><Icon className="size-5" aria-hidden /></div>
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
