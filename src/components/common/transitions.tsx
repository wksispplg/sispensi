import { ViewTransition, type ReactNode } from "react";

/*
 * View Transitions beranda ⇄ login. Animasi CSS-nya ada di globals.css
 * (.morph, .nav-forward, .nav-back). Kelasnya sengaja TIDAK bergantung pada
 * `transitionTypes`: saat data halaman tujuan belum di-prefetch, Next
 * menjalankan navigasi di transisi lain sehingga tipe itu hilang (teruji di
 * build produksi untuk login → beranda).
 */

type Direction = "nav-forward" | "nav-back";

/**
 * Bungkus isi halaman agar bergeser saat halaman itu muncul/hilang karena
 * navigasi: `exit` = arah saat pergi, `enter` = arah saat kembali.
 * Pasang di page.tsx (bukan layout — layout tidak ikut berganti).
 * Catatan: saat diuji, enter/exit tidak terpicu untuk halaman login (di bawah
 * layout (auth)), jadi form login memakai animasi CSS `animate-enter-right`.
 */
export function PageSlide({
  enter,
  exit,
  children,
}: {
  enter: Direction;
  exit: Direction;
  children: ReactNode;
}) {
  return (
    <ViewTransition enter={enter} exit={exit} default="none">
      {children}
    </ViewTransition>
  );
}

/**
 * Panel merah yang sama di hero beranda & panel login: saat berpindah
 * halaman, panel ini berubah bentuk (morph) dari satu posisi ke posisi lain.
 * Isi panel dipudarkan dulu oleh TransitionLink agar yang di-morph panel polos.
 */
export function BrandPanelMorph({ children }: { children: ReactNode }) {
  return (
    <ViewTransition name="brand-panel" share="morph" default="none">
      {children}
    </ViewTransition>
  );
}
