/**
 * Menu per peran — satu sumber untuk navigasi header (desktop), navigasi bawah
 * (HP), dan tile dashboard, agar ketiganya selalu konsisten.
 */
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  FilePlus2,
  History,
  House,
  Timer,
  Users,
} from "lucide-react";

import {
  ADMIN_HOME_PATH,
  ADMIN_SCHEDULES_PATH,
  APPROVAL_HISTORY_PATH,
  APPROVALS_PATH,
  DASHBOARD_PATH,
  PEMANTAUAN_PATH,
  REKAP_PATH,
  ROLES,
  type Role,
} from "@/lib/constants";

export type NavItem = {
  href: string;
  /** Label pendek untuk menu navigasi. */
  label: string;
  /** Judul & deskripsi untuk tile dashboard. */
  title: string;
  description: string;
  icon: LucideIcon;
};

const HOME: NavItem = {
  href: DASHBOARD_PATH,
  label: "Beranda",
  title: "Beranda",
  description: "",
  icon: House,
};

const NAV: Record<Role, NavItem[]> = {
  [ROLES.SISWA]: [
    HOME,
    {
      href: "/izin/ajukan",
      label: "Ajukan",
      title: "Ajukan Izin",
      description: "Buat pengajuan izin baru secara digital.",
      icon: FilePlus2,
    },
    {
      href: "/izin",
      label: "Riwayat",
      title: "Riwayat Pengajuan",
      description: "Pantau status & unduh surat izin Anda.",
      icon: History,
    },
  ],
  [ROLES.GURU_MAPEL]: [
    HOME,
    {
      href: APPROVALS_PATH,
      label: "Persetujuan",
      title: "Perlu Persetujuan",
      description: "Tinjau & putuskan pengajuan izin siswa.",
      icon: ClipboardList,
    },
    {
      href: PEMANTAUAN_PATH,
      label: "Pemantauan",
      title: "Pemantauan Dispen",
      description: "Pantau siswa yang Anda izinkan keluar & kelas perwalian Anda.",
      icon: Timer,
    },
    {
      href: APPROVAL_HISTORY_PATH,
      label: "Riwayat",
      title: "Riwayat Keputusan",
      description: "Lihat pengajuan yang pernah Anda proses.",
      icon: History,
    },
  ],
  [ROLES.WALI_KELAS]: [
    HOME,
    {
      href: APPROVALS_PATH,
      label: "Persetujuan",
      title: "Perlu Persetujuan",
      description: "Tinjau & putuskan pengajuan izin siswa.",
      icon: ClipboardList,
    },
    {
      href: PEMANTAUAN_PATH,
      label: "Pemantauan",
      title: "Pemantauan Dispen",
      description: "Pantau siswa kelas Anda yang sedang dispen keluar.",
      icon: Timer,
    },
    {
      href: APPROVAL_HISTORY_PATH,
      label: "Riwayat",
      title: "Riwayat Keputusan",
      description: "Lihat pengajuan yang pernah Anda proses.",
      icon: History,
    },
  ],
  [ROLES.GURU_BK]: [
    HOME,
    {
      href: APPROVALS_PATH,
      label: "Persetujuan",
      title: "Perlu Persetujuan",
      description: "Tinjau pengajuan eskalasi tahap akhir.",
      icon: ClipboardList,
    },
    {
      href: PEMANTAUAN_PATH,
      label: "Pemantauan",
      title: "Pemantauan Dispen",
      description: "Pantau seluruh siswa yang sedang dispen keluar.",
      icon: Timer,
    },
    {
      href: APPROVAL_HISTORY_PATH,
      label: "Riwayat",
      title: "Riwayat Keputusan",
      description: "Pengajuan yang pernah Anda putuskan.",
      icon: History,
    },
    {
      href: REKAP_PATH,
      label: "Rekap",
      title: "Dashboard Rekap",
      description: "Rekapitulasi & tren perizinan siswa.",
      icon: BarChart3,
    },
  ],
  [ROLES.ADMIN]: [
    HOME,
    {
      href: ADMIN_HOME_PATH,
      label: "Data Master",
      title: "Data Master",
      description: "Kelola siswa, guru, kelas & mata pelajaran.",
      icon: Users,
    },
    {
      href: ADMIN_SCHEDULES_PATH,
      label: "Jadwal",
      title: "Jadwal Pelajaran",
      description: "Kelola mata pelajaran & jadwal per kelas.",
      icon: CalendarClock,
    },
    {
      href: PEMANTAUAN_PATH,
      label: "Pemantauan",
      title: "Pemantauan Dispen",
      description: "Pantau seluruh siswa yang sedang dispen keluar.",
      icon: Timer,
    },
    {
      href: REKAP_PATH,
      label: "Rekap",
      title: "Dashboard Rekap",
      description: "Rekapitulasi perizinan seluruh sekolah.",
      icon: BarChart3,
    },
  ],
};

/** Menu navigasi untuk sebuah peran (termasuk Beranda). */
export function navItemsForRole(role: Role): NavItem[] {
  return NAV[role] ?? [HOME];
}

/**
 * Item yang aktif untuk path saat ini — dipilih yang paling spesifik, mis.
 * "/admin/jadwal" mengaktifkan "Jadwal", bukan "Data Master".
 */
export function activeNavHref(
  pathname: string,
  items: NavItem[],
): string | undefined {
  return items
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}
