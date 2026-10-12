"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Role } from "@/lib/constants";
import { activeNavHref, navItemsForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** Menu di header — tampil di layar lebar (≥ lg). */
export function DesktopNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = navItemsForRole(role);
  const active = activeNavHref(pathname, items);

  return (
    <nav aria-label="Navigasi utama" className="hidden flex-1 items-center gap-1 px-4 lg:flex">
      {items.map((item) => {
        const isActive = item.href === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "focus-visible:ring-ring/50 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px]",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
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
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/50 flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px]",
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
