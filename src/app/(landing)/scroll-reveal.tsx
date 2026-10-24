"use client";

import { useEffect } from "react";

/**
 * Memunculkan elemen ber-atribut `data-reveal` saat masuk layar (sekali saja)
 * dengan menambahkan `data-revealed`. Gaya animasinya ada di globals.css.
 */
export function ScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(
      "[data-reveal]:not([data-revealed])",
    );
    const show = (el: Element) => el.setAttribute("data-revealed", "");

    if (!("IntersectionObserver" in window)) {
      els.forEach(show);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          show(entry.target);
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
