import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { BrandPanelMorph } from "@/components/common/transitions";
import { TransitionLink } from "@/components/common/transition-link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

type Panel = {
  title: string;
  subtitle: string;
  steps: { title: string; desc: string }[];
};

/** Isi panel merah, disesuaikan dengan tombol yang diklik di landing (?as=). */
const PANELS: Record<"siswa" | "pengajar", Panel> = {
  siswa: {
    title: "Ajukan Dispensasi Online",
    subtitle: "Aplikasi website dispensasi online siswa SMK Telkom Purwokerto",
    steps: [
      {
        title: "Masuk",
        desc: "Masukkan email dan password untuk melanjutkan",
      },
      {
        title: "Ajukan Dispen",
        desc: "Ajukan dispen dengan mengisi seluruh kriteria yang ada",
      },
      { title: "Verifikasi", desc: "Tunggu guru untuk mengonfirmasi dispen" },
    ],
  },
  pengajar: {
    title: "Proses Dispensasi Online",
    subtitle:
      "Tinjau dan putuskan izin siswa SMK Telkom Purwokerto secara digital",
    steps: [
      {
        title: "Masuk",
        desc: "Masukkan email dan password untuk melanjutkan",
      },
      {
        title: "Tinjau Pengajuan",
        desc: "Periksa alasan dan bukti yang dikirim siswa",
      },
      {
        title: "Beri Keputusan",
        desc: "Setujui atau tolak — surat izin terbit otomatis",
      },
    ],
  },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; redirectedFrom?: string }>;
}) {
  const { as, redirectedFrom } = await searchParams;
  const panel = PANELS[as === "pengajar" ? "pengajar" : "siswa"];

  return (
    <div className="flex flex-1 flex-col gap-2 overflow-x-clip p-3 sm:p-4 lg:flex-row lg:gap-8">
      <BrandPanelMorph>
        <BrandPanel panel={panel} />
      </BrandPanelMorph>
      {/* Form masuk dari kanan (animasi CSS, jalan juga saat dibuka langsung) */}
      <div className="animate-enter-right flex flex-1 justify-center px-2 py-10 [animation-delay:200ms] motion-reduce:animate-none sm:px-6 lg:items-center lg:py-6">
        <LoginForm next={redirectedFrom} />
      </div>
    </div>
  );
}

function BrandPanel({ panel }: { panel: Panel }) {
  return (
    <section className="bg-brand-grid flex flex-col rounded-[1.75rem] p-6 text-white sm:p-8 lg:min-h-[calc(100svh-2rem)] lg:w-[56%]">
      {/* Isi panel: memudar saat keluar, muncul bertahap saat masuk */}
      <div data-fade-on-leave className="flex flex-1 flex-col">
        <TransitionLink
          href="/"
          aria-label="SisPensi — kembali ke beranda"
          className="w-fit rounded-md text-lg font-bold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-white/60"
        >
          SisPensi
        </TransitionLink>

        <div className="mt-8 lg:mt-auto">
          <span className="animate-rise inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-white/10 px-3 py-1 text-xs font-medium [animation-delay:250ms] motion-reduce:animate-none">
            <ShieldCheck className="size-3.5" aria-hidden /> Sistem Perizinan
            Siswa Digital
          </span>
          <h2 className="animate-rise mt-4 text-3xl leading-tight font-semibold tracking-tight text-balance [animation-delay:320ms] motion-reduce:animate-none sm:text-4xl xl:text-[2.75rem]">
            {panel.title}
          </h2>
          <p className="animate-rise mt-2 max-w-sm text-sm text-pretty text-white/90 [animation-delay:390ms] motion-reduce:animate-none sm:text-base">
            {panel.subtitle}
          </p>

          <ol className="mt-8 hidden gap-3 sm:grid sm:grid-cols-3">
            {panel.steps.map((s, i) => {
              const current = i === 0; // halaman ini = langkah "Masuk"
              return (
                <li
                  key={s.title}
                  aria-current={current ? "step" : undefined}
                  style={{ animationDelay: `${460 + i * 80}ms` }}
                  className={cn(
                    "animate-rise flex min-h-36 flex-col rounded-xl p-4 motion-reduce:animate-none",
                    current
                      ? "bg-white text-zinc-900 shadow-lg shadow-black/10"
                      : "border border-white/30 bg-white/10",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md text-xs font-semibold",
                      current
                        ? "bg-brand text-white"
                        : "border border-white/70",
                    )}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="mt-auto pt-5">
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        current && "text-brand",
                      )}
                    >
                      {s.title}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-xs",
                        current ? "text-zinc-600" : "text-white/85",
                      )}
                    >
                      {s.desc}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
