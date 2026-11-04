import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function StaffEmpty({ title = "Belum ada pengajuan", description }: { title?: string; description?: string }) {
  return <div className="flex min-h-44 flex-col items-center justify-center gap-3 p-6 text-center"><span className="flex size-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-400"><Inbox className="size-5" aria-hidden /></span><p className="text-sm font-medium">{title}</p>{description ? <p className="max-w-sm text-xs leading-relaxed text-[#747983]">{description}</p> : null}</div>;
}

export function StaffStat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "red" | "green" }) {
  return <div className="app-panel rounded-2xl px-5 py-5 sm:px-6 lg:py-6"><p className="text-xs text-[#747983] lg:text-sm">{label}</p><p className={`mt-2 text-[32px] leading-none font-semibold tabular-nums lg:text-[40px] ${tone === "red" ? "text-[#dc0000]" : tone === "green" ? "text-[#489d00]" : "text-black"}`}>{value.toLocaleString("id-ID")}</p></div>;
}

export function StaffError({ children = "Data belum dapat dimuat. Periksa koneksi dan muat ulang halaman." }: { children?: ReactNode }) {
  return <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{children}</p>;
}
