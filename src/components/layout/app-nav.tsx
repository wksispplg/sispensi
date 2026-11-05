"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { DASHBOARD_PATH, ROLE_LABELS, ROLES, type Role } from "@/lib/constants";
import { activeNavHref, navItemsForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function DesktopNav({ role, collapsed = false, onToggle }: { role: Role; collapsed?: boolean; onToggle?: () => void }) {
  const pathname = usePathname();
  const items = navItemsForRole(role);
  const active = activeNavHref(pathname, items);
  const staff = role !== ROLES.SISWA;
  const toggleLabel = collapsed ? "Perluas sidebar" : "Ciutkan sidebar";
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return <aside className={cn("portal-sidebar fixed inset-y-0 left-0 z-30 hidden w-[var(--app-sidebar-width)] flex-col bg-white px-4 pt-8 pb-6 lg:flex", staff ? "staff-sidebar" : "student-sidebar", collapsed && "sidebar-collapsed")}>
    <div className={cn("flex items-center justify-between gap-2", collapsed && "justify-center")}>
      {!collapsed && <Link href={DASHBOARD_PATH} aria-label="SisPensi — Beranda" className="portal-sidebar-brand text-brand w-fit rounded-sm text-xl font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-brand/40">SisPensi</Link>}
      {onToggle && <button type="button" aria-label={toggleLabel} title={toggleLabel} aria-expanded={!collapsed} aria-controls="desktop-navigation" onClick={onToggle} className="flex size-9 shrink-0 items-center justify-center rounded-md text-zinc-600 outline-none hover:bg-zinc-100 hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-brand/40"><ToggleIcon className="size-5" aria-hidden /></button>}
    </div>
    <div className="portal-sidebar-menu mt-5 border-t border-zinc-200 pt-2">
      <p className={cn("mb-2 text-[10px] font-medium text-slate-600 uppercase", collapsed && "sr-only")}>{role === ROLES.GURU_MAPEL ? "Guru" : ROLE_LABELS[role]}</p>
      <nav id="desktop-navigation" aria-label="Navigasi utama"><ul className="flex flex-col gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          return <li key={item.href}><Link href={item.href} aria-current={item.href === active ? "page" : undefined} title={collapsed ? item.title : undefined} className={cn("flex min-h-10 items-center gap-2.5 rounded-md px-3 py-2 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40", item.href === active ? "bg-[#f4f5f7] font-medium text-zinc-950" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900", collapsed && "justify-center px-0")}><Icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden /><span className={collapsed ? "sr-only" : undefined}>{item.title}</span></Link></li>;
        })}
      </ul></nav>
    </div>
    <div className="mt-auto pt-10">
      <p className={cn("mb-2 text-[10px] font-medium text-slate-600 uppercase", collapsed && "sr-only")}>Setelan</p>
      <form action="/auth/signout" method="post"><button type="submit" title={collapsed ? "Keluar" : undefined} className={cn("text-brand flex min-h-10 w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs outline-none hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-brand/40", collapsed && "justify-center px-0")}><LogOut className="size-4" strokeWidth={1.5} aria-hidden /><span className={collapsed ? "sr-only" : undefined}>Keluar</span></button></form>
    </div>
  </aside>;
}

/** Maksimal lima tombol; menu tambahan tetap dapat diakses pada HP kecil. */
export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = navItemsForRole(role);
  const active = activeNavHref(pathname, items);
  const primary = items.length > 5 ? items.slice(0, 4) : items;
  const extra = items.length > 5 ? items.slice(4) : [];
  return <nav aria-label="Navigasi utama" className="bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
    <ul className="mx-auto flex max-w-lg">
      {primary.map((item) => {
        const Icon = item.icon;
        return <li key={item.href} className="min-w-0 flex-1"><Link href={item.href} aria-label={item.title} aria-current={item.href === active ? "page" : undefined} className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-brand/40 min-[360px]:text-[11px]", item.href === active ? "text-primary" : "text-muted-foreground")}><Icon className="size-5" aria-hidden /><span className="max-w-full truncate px-0.5">{item.label}</span></Link></li>;
      })}
      {extra.length ? <li className="min-w-0 flex-1"><details className="group">
        <summary className={cn("flex h-16 cursor-pointer list-none flex-col items-center justify-center gap-1 text-[10px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-brand/40 min-[360px]:text-[11px] [&::-webkit-details-marker]:hidden", extra.some((item) => item.href === active) ? "text-primary" : "text-muted-foreground")}><Menu className="size-5" aria-hidden />Menu</summary>
        <div className="absolute right-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-3 rounded-2xl border bg-white p-2 shadow-xl sm:left-auto sm:w-72">
          <p className="px-3 py-2 text-xs text-zinc-500">Menu lainnya</p>
          {extra.map((item) => {
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")} aria-current={item.href === active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-zinc-50", item.href === active && "bg-red-50 text-red-600")}><Icon className="size-4" aria-hidden />{item.title}</Link>;
          })}
        </div>
      </details></li> : null}
    </ul>
  </nav>;
}
