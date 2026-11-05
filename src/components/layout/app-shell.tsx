"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, LogOut } from "lucide-react";

import { DASHBOARD_PATH, ROLE_LABELS, ROLES, STUDENT_LETTERS_PATH, STUDENT_ENTRY_PATH, NOTIFICATIONS_PATH } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";
import { DesktopNav, MobileNav } from "./app-nav";
import { NotificationBell } from "./notification-bell";
import { schoolTerm } from "./school-term";

export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return <PortalShell profile={profile} pathname={pathname}>{children}</PortalShell>;
}

function PortalShell({ profile, pathname, children }: { profile: Profile; pathname: string; children: ReactNode }) {
  const pages: Record<string, { title: string; description?: string }> = {
    [DASHBOARD_PATH]: { title: "Beranda", description: "Selamat datang!" },
    "/izin/ajukan": { title: "Ajukan Dispensasi", description: "Tulis deskripsi alasan dispensasi kamu" },
    [STUDENT_ENTRY_PATH]: { title: "Izin Masuk Kelas", description: "Isi alasan dan pilih jam pelajaran untuk masuk kelas" },
    "/izin": { title: "Riwayat Pengajuan", description: "Pantau status dan unduh surat izin Anda." },
    [STUDENT_LETTERS_PATH]: { title: "Surat Izin Digital" },
    [NOTIFICATIONS_PATH]: { title: "Notifikasi" },
  };
  const staff = profile.role !== ROLES.SISWA;
  const staffPages: Record<string, { title: string; description?: string }> = {
    [DASHBOARD_PATH]: { title: "Beranda", description: "Selamat datang!" },
    "/persetujuan": { title: "Perlu Persetujuan" },
    "/riwayat-keputusan": { title: "Riwayat Keputusan" },
    [NOTIFICATIONS_PATH]: { title: "Notifikasi" },
    "/admin": { title: "Data Master", description: "Kelola data sekolah dalam satu tempat." },
    "/admin/siswa": { title: "Data Siswa", description: "Kelola akun siswa dan impor data sekolah." },
    "/admin/guru": { title: "Data Guru", description: "Kelola akun dan peran guru." },
    "/admin/kelas": { title: "Data Kelas", description: "Kelola kelas dan wali kelas." },
    "/admin/jadwal": { title: "Jadwal Pelajaran", description: "Atur mata pelajaran dan jadwal setiap kelas." },
    "/rekap": { title: "Rekap Perizinan", description: "Ringkasan dan laporan perizinan siswa." },
    "/scan": { title: "Scan QR Surat", description: "Periksa surat izin digital siswa." },
  };
  const page = (staff ? staffPages : pages)[pathname] ?? { title: "Detail Pengajuan", description: "Informasi dan status pengajuan izin." };
  const style = { "--app-sidebar-width": staff ? "clamp(214px, 20.625vw, 297px)" : "214px" } as CSSProperties;
  return <div style={style} className={cn("portal-app student-app min-h-svh flex-1 bg-[#f5f6f8]", staff && "staff-app")}>
    <DesktopNav role={profile.role} />
    <div className="flex min-h-svh min-w-0 flex-col lg:pl-[var(--app-sidebar-width)]">
      <div className={cn("flex min-h-11 items-center justify-between gap-4 bg-[#343b41] px-4 text-white sm:px-7", staff && "staff-school-bar")}>
        <Link href={DASHBOARD_PATH} aria-label="Beranda SMK Telkom Purwokerto" className="flex items-center gap-1.5 py-2">
          <Image src="/branding/telkom-schools.png" alt="" width={22} height={28} className="h-6 w-auto brightness-0 invert" />
          <span className="text-[10px] leading-[1.05] font-medium">SMK Telkom<br />Purwokerto</span>
        </Link>
        <span className="text-[11px] whitespace-nowrap" suppressHydrationWarning>{schoolTerm()}</span>
      </div>
      <header className={cn("flex min-h-[70px] items-center justify-between gap-4 px-4 py-3 sm:px-7", staff && "staff-page-header")}>
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-lg leading-6 font-semibold tracking-tight">{page.title}{pathname === NOTIFICATIONS_PATH ? <Bell className="size-5" strokeWidth={1.6} aria-hidden /> : null}</h1>
          {page.description ? <p className="mt-0.5 text-xs leading-relaxed text-[#6f7380]">{page.description}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <NotificationBell userId={profile.id} role={profile.role} />
          <AccountMenu profile={profile} />
        </div>
      </header>
      <main className={cn("w-full min-w-0 flex-1 px-4 pt-0 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-7 lg:pb-8", staff && "staff-main")}>{children}</main>
      <MobileNav role={profile.role} />
    </div>
  </div>;
}

function AccountMenu({ profile }: { profile: Profile }) {
  return (
    <details className="group relative">
      <summary
        aria-label="Menu akun"
        className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand/40 [&::-webkit-details-marker]:hidden"
      >
        <span
          aria-hidden
          className="size-9 rounded-full border border-zinc-950 bg-[#383838]"
        />
        <ChevronDown
          className="size-3.5 transition-transform group-open:rotate-180"
          strokeWidth={1.5}
          aria-hidden
        />
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border bg-white p-2 shadow-lg">
        <div className="border-b px-3 py-3">
          <p className="text-sm font-medium wrap-anywhere">
            {profile.full_name?.trim() || "Pengguna"}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {ROLE_LABELS[profile.role]}
            {profile.nis ? ` · ${profile.nis}` : ""}
          </p>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="text-brand flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <LogOut className="size-4" aria-hidden />
            Keluar
          </button>
        </form>
      </div>
    </details>
  );
}
