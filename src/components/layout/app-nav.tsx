"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { DASHBOARD_PATH, ROLE_LABELS, type Role } from "@/lib/constants";
import { activeNavHref, navItemsForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** Sidebar desktop; menu tetap mengikuti hak akses pengguna. */
export function DesktopNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = navItemsForRole(role);
  const active = activeNavHref(pathname, items);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[212px] flex-col bg-white px-4 pt-8 pb-6 lg:flex xl:w-60">
      <Link
        href={DASHBOARD_PATH}
        aria-label="SisPensi — Home"
        className="text-brand w-fit rounded-sm text-xl font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        SisPensi
      </Link>

      <div className="mt-5 border-t border-zinc-200 pt-2">
        <p className="mb-2 text-[10px] font-medium text-slate-600 uppercase">
          {ROLE_LABELS[role]}
        </p>
        <nav aria-label="Navigasi utama">
          <ul className="flex flex-col gap-2">
            {items.map((item) => {
              const isActive = item.href === active;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex min-h-10 items-center gap-2.5 rounded-md px-3 py-2 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40",
                      isActive
                        ? "bg-[#f4f5f7] font-medium text-zinc-950"
                        : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900",
                    )}
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                    {item.href === DASHBOARD_PATH ? "Home" : item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="mt-auto pt-10">
        <p className="mb-2 text-[10px] font-medium text-slate-600 uppercase">
          Setelan
        </p>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="text-brand flex min-h-10 w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs outline-none transition-colors hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <LogOut className="size-4" strokeWidth={1.5} aria-hidden />
            Keluar
          </button>
        </form>
      </div>
    </aside>
  );
}

/** Navigasi bawah — tampil di HP & tablet (< lg). */
export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = navItemsForRole(role);
  const active = activeNavHref(pathname, items);

  return (
    <nav
      aria-label="Navigasi utama"
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {items.map((item) => {
          const isActive = item.href === active;
          const Icon = item.icon;
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/50 flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors outline-none min-[360px]:text-[11px] focus-visible:ring-[3px] sm:text-xs",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
