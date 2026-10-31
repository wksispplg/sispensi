"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, GraduationCap, LogOut } from "lucide-react";

import { DASHBOARD_PATH, ROLE_LABELS } from "@/lib/constants";
import { activeNavHref, navItemsForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";
import { Button } from "@/components/ui/button";
import { DesktopNav, MobileNav } from "./app-nav";
import { NotificationBell } from "./notification-bell";

export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isHome = pathname === DASHBOARD_PATH;
  const isWidePage = isHome || pathname === "/izin/ajukan";
  const items = navItemsForRole(profile.role);
  const active = activeNavHref(pathname, items);
  const title = isHome
    ? "Home"
    : (items.find((item) => item.href === active)?.title ?? "SisPensi");

  return (
    <div className="min-h-svh flex-1 lg:bg-[#f5f6f8]">
      <DesktopNav role={profile.role} />
      <div className="flex min-h-svh min-w-0 flex-col lg:pl-[212px] xl:pl-60">
        <header className="relative z-20 border-b bg-background lg:mx-7 lg:mt-7 lg:border-[#d9dde1] lg:bg-transparent lg:pb-3 xl:mx-8 xl:mt-8">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:max-w-none lg:px-0 lg:py-0">
            <Link
              href={DASHBOARD_PATH}
              aria-label="Ke beranda SIPENSI"
              className="flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand/40 lg:hidden"
            >
              <span className="bg-brand flex size-8 shrink-0 items-center justify-center rounded-lg text-white">
                <GraduationCap className="size-5" aria-hidden />
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-semibold">SIPENSI</span>
                <span className="text-muted-foreground hidden text-xs sm:block">
                  SMK Telkom Purwokerto
                </span>
              </span>
            </Link>
            <div className="hidden min-w-0 lg:block">
              <h1 className="text-lg leading-6 font-medium tracking-tight text-zinc-950">
                {title}
              </h1>
              {isHome ? (
                <p className="text-[11px] leading-4 text-zinc-500">
                  Selamat datang !
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-3 lg:gap-2">
              <NotificationBell userId={profile.id} role={profile.role} />
              <div className="hidden text-right leading-tight sm:block lg:hidden">
                <p className="max-w-[10rem] truncate text-sm font-medium">
                  {profile.full_name?.trim() || "Pengguna"}
                </p>
                <p className="text-muted-foreground text-xs">
                  {ROLE_LABELS[profile.role]}
                </p>
              </div>
              <form action="/auth/signout" method="post" className="lg:hidden">
                <Button type="submit" variant="outline" size="sm">
                  Keluar
                </Button>
              </form>
              <div className="hidden lg:block">
                <AccountMenu profile={profile} />
              </div>
            </div>
          </div>
        </header>

        <main
          className={cn(
            "mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-7 lg:pt-2 lg:pb-8 xl:px-8",
            isWidePage && "lg:max-w-none",
          )}
        >
          {children}
        </main>
        <MobileNav role={profile.role} />
      </div>
    </div>
  );
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
