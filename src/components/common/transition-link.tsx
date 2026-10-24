"use client";

import { useLayoutEffect, useRef, type ComponentProps } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** Lama isi halaman memudar sebelum navigasi (samakan dengan CSS di globals). */
const LEAVE_MS = 200;
const LEAVING_ATTR = "data-leaving";

/** Pengaman bila navigasi gagal (satu untuk semua link di halaman). */
let safetyTimer: number | undefined;

function stopLeaving() {
  window.clearTimeout(safetyTimer);
  document.documentElement.removeAttribute(LEAVING_ATTR);
}

type Props = Omit<ComponentProps<typeof Link>, "href" | "onNavigate"> & {
  href: string;
};

/**
 * <Link> dengan koreografi keluar untuk transisi beranda ⇄ login. Saat diklik,
 * elemen ber-`data-fade-on-leave` di halaman ini memudar dulu (~200 ms) —
 * jadi ada respons instan dan panel merah yang di-morph sudah polos — lalu
 * navigasi berjalan dan View Transition mengambil alih (lihat transitions.tsx).
 * Klik dengan Ctrl/Cmd/tengah tetap membuka tab baru seperti biasa.
 */
export function TransitionLink({ href, ...props }: Props) {
  const router = useRouter();
  const leaving = useRef(false);

  // Penanda dilepas saat halaman lama dibongkar, sebelum halaman baru
  // "dipotret" oleh View Transition, agar isi halaman baru tidak ikut pudar.
  useLayoutEffect(() => stopLeaving, []);

  return (
    <Link
      href={href}
      onNavigate={(e) => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          return; // navigasi biasa, tanpa jeda
        }
        e.preventDefault();
        if (leaving.current) return;
        leaving.current = true;
        document.documentElement.setAttribute(LEAVING_ATTR, "");
        window.setTimeout(() => {
          router.push(href);
        }, LEAVE_MS);
        // Pengaman bila navigasi gagal: kembalikan tampilan.
        safetyTimer = window.setTimeout(() => {
          stopLeaving();
          leaving.current = false;
        }, 8000);
      }}
      {...props}
    />
  );
}
