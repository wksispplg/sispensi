import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  CircleCheck,
  Mail,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";

import { getSessionUser } from "@/lib/auth";
import { DASHBOARD_PATH, LOGIN_PATH } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { BrandPanelMorph, PageSlide } from "@/components/common/transitions";
import { TransitionLink } from "@/components/common/transition-link";
import { AppPreview } from "./app-preview";
import { LetterPreview } from "./letter-preview";
import { ScrollReveal } from "./scroll-reveal";
import { ChatWidget } from "@/features/chatbot/chat-widget";

const pill =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold outline-none transition-colors focus-visible:ring-[3px]";
const pillWhite = cn(
  pill,
  "text-brand bg-white shadow-sm hover:bg-white/90 focus-visible:ring-white/60",
);
const pillOutline = cn(
  pill,
  "border border-white/80 text-white hover:bg-white/10 focus-visible:ring-white/60",
);

const steps: { title: string; desc: string; icon: LucideIcon }[] = [
  {
    title: "Ajukan Dispen",
    desc: "Siswa mengisi jenis izin, alasan, dan bukti.",
    icon: Smartphone,
  },
  {
    title: "Dispen Disetujui",
    desc: "Diproses otomatis oleh guru penanggung jawab.",
    icon: CircleCheck,
  },
  {
    title: "Terbit Surat",
    desc: "Surat izin PDF ber-QR Code terbit otomatis.",
    icon: Mail,
  },
  {
    title: "Verifikasi",
    desc: "Petugas memindai QR untuk memastikan keasliannya.",
    icon: BadgeCheck,
  },
];

const SCHOOL_SITE = "https://smktelkom-pwt.sch.id/";

const footerLinks: {
  title: string;
  items: { label: string; href: string }[];
}[] = [
  {
    title: "Tautan",
    items: [
      { label: "Beranda", href: "/" },
      { label: "Masuk", href: LOGIN_PATH },
      { label: "Website Sekolah", href: SCHOOL_SITE },
    ],
  },
  {
    title: "Kontak",
    items: [
      { label: "+62 812-2970-1800", href: "https://wa.me/6281229701800" },
      { label: "smktelkom-pwt.sch.id", href: SCHOOL_SITE },
    ],
  },
  {
    title: "Media Sosial",
    items: [
      { label: "Instagram", href: "https://www.instagram.com/stematelpwt/" },
      { label: "Facebook", href: "https://www.facebook.com/stematelpwt" },
      { label: "Website Sekolah", href: SCHOOL_SITE },
      { label: "Youtube", href: "https://youtube.com/@stematelpwt" },
      { label: "Tiktok", href: "https://www.tiktok.com/@stematelpwt" },
    ],
  },
];

/** Jeda animasi muncul-saat-scroll (lihat [data-reveal] di globals.css). */
function revealDelay(ms: number): CSSProperties {
  return { "--reveal-delay": `${ms}ms` } as CSSProperties;
}

// Di luar komponen agar bebas aturan react-hooks/purity.
function currentYear(): number {
  return new Date().getFullYear();
}

export default async function Home() {
  // Pengguna yang sudah login diarahkan ke dashboard.
  const user = await getSessionUser();
  if (user) redirect(DASHBOARD_PATH);

  return (
    <PageSlide exit="nav-forward" enter="nav-back">
      <div className="flex min-h-svh flex-col overflow-x-clip bg-white text-zinc-900">
        <ScrollReveal />
        <Hero />
        <About />
        <HowItWorks />
        <CallToAction />
        <SiteFooter />
        <ChatWidget />
      </div>
    </PageSlide>
  );
}

function Hero() {
  return (
    <div className="p-3 sm:p-4">
      <BrandPanelMorph>
        <section className="bg-brand-grid relative isolate overflow-hidden rounded-[1.75rem] text-white">
          <GlassShapes />

          <header
            data-fade-on-leave
            className="relative flex items-center justify-between px-5 py-5 sm:px-8"
          >
            <Link
              href="/"
              className="rounded-md text-lg font-bold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-white/60"
            >
              SisPensi
            </Link>
            <TransitionLink
              href={LOGIN_PATH}
              className={cn(pillWhite, "h-10 px-4")}
            >
              <UserRound className="size-4" aria-hidden /> Masuk
            </TransitionLink>
          </header>

          {/* Muncul bertahap saat halaman dimuat */}
          <div
            data-fade-on-leave
            className="relative mx-auto flex max-w-3xl flex-col items-center px-5 pt-6 text-center sm:pt-10"
          >
            <span className="animate-rise inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-white/10 px-3 py-1 text-xs font-medium motion-reduce:animate-none">
              <ShieldCheck className="size-3.5" aria-hidden /> Sistem Perizinan
              Siswa Digital
            </span>
            <h1 className="animate-rise mt-5 text-4xl leading-tight font-semibold tracking-tight text-balance [animation-delay:100ms] motion-reduce:animate-none sm:text-5xl lg:text-6xl lg:leading-[1.1]">
              Sekarang Dispen Mudah <br className="hidden sm:block" />
              Pakai <em className="font-bold">SisPensi</em>
            </h1>
            <p className="animate-rise mt-4 max-w-md text-sm text-pretty text-white/90 [animation-delay:200ms] motion-reduce:animate-none sm:text-base">
              <em>SisPensi</em> memberikan inovasi izin manual berbasis kertas
              dengan alur digital
            </p>
            <div className="animate-rise mt-7 flex w-full max-w-xs flex-col gap-3 [animation-delay:300ms] motion-reduce:animate-none sm:w-auto sm:max-w-none sm:flex-row">
              <TransitionLink
                href={`${LOGIN_PATH}?as=siswa`}
                className={pillWhite}
              >
                Masuk Sebagai Siswa{" "}
                <ArrowRight className="size-4" aria-hidden />
              </TransitionLink>
              <TransitionLink
                href={`${LOGIN_PATH}?as=pengajar`}
                className={pillOutline}
              >
                Masuk Sebagai Guru
              </TransitionLink>
            </div>
          </div>

          {/* Cuplikan aplikasi, terpotong & memudar ke merah di bawah */}
          <div className="animate-rise relative mx-auto mt-10 max-w-3xl px-5 [--rise-from:4rem] [animation-delay:450ms] [animation-duration:1.1s] motion-reduce:animate-none sm:mt-14 sm:px-8">
            <div
              data-fade-on-leave
              className="relative h-56 overflow-hidden sm:h-72"
            >
              <AppPreview />
              <div
                aria-hidden
                className="to-brand-dark via-brand/40 absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-b from-transparent"
              />
            </div>
          </div>
        </section>
      </BrandPanelMorph>
    </div>
  );
}

/**
 * Panel kaca tembus pandang di kiri-kanan hero (dekoratif, layar lebar saja),
 * melayang pelan naik-turun dengan tempo berbeda-beda.
 */
function GlassShapes() {
  const glass =
    "animate-float absolute rounded-2xl border border-white/30 bg-white/10 shadow-[inset_0_1px_0_rgb(255_255_255/0.3)] backdrop-blur-[2px] motion-reduce:animate-none";
  return (
    <div
      aria-hidden
      data-fade-on-leave
      className="pointer-events-none absolute inset-0 -z-10 hidden lg:block"
    >
      <div
        className={cn(
          glass,
          "top-[30%] -left-10 h-16 w-28 -rotate-6 [animation-duration:7s]",
        )}
      />
      <div
        className={cn(
          glass,
          "top-[44%] left-6 h-36 w-32 -rotate-12 [animation-delay:-3s] xl:left-12 xl:h-44 xl:w-40",
        )}
      />
      <div
        className={cn(
          glass,
          "top-[36%] -right-10 h-20 w-28 rotate-6 [animation-delay:-5s] [animation-duration:9s]",
        )}
      />
      <div
        className={cn(
          glass,
          "top-[46%] right-6 h-40 w-32 rotate-12 [animation-delay:-1.5s] xl:right-12 xl:h-48 xl:w-40",
        )}
      />
    </div>
  );
}

function About() {
  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 md:grid-cols-2 lg:gap-20 lg:py-24">
      <div data-reveal="left">
        <p className="text-muted-foreground text-sm">Pengertian</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Apa itu SisPensi?
        </h2>
        <p className="text-muted-foreground mt-4 text-base leading-relaxed text-pretty sm:text-lg">
          Aplikasi web perizinan siswa untuk SMK Telkom Purwokerto yang membuat
          proses dispen atau izin menjadi lebih cepat, tercatat rapi, dan ramah
          lingkungan (paperless).
        </p>
        <a
          href="#cara-kerja"
          className={cn(
            pill,
            "bg-brand hover:bg-brand-dark focus-visible:ring-brand/40 mt-6 h-10 px-5 font-medium text-white",
          )}
        >
          Jelajahi Caranya <ArrowDown className="size-4" aria-hidden />
        </a>
      </div>
      <div data-reveal="right" style={revealDelay(150)}>
        <LetterPreview />
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="cara-kerja" className="scroll-mt-4 bg-zinc-50">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
        <h2
          data-reveal
          className="text-center text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Cara Kerja <em className="text-brand font-bold">SisPensi</em>
        </h2>

        <ol className="relative mx-auto mt-12 grid max-w-md gap-8 lg:max-w-none lg:grid-cols-4 lg:gap-6">
          {/* Garis penghubung horizontal (desktop) */}
          <span
            aria-hidden
            data-reveal="draw"
            style={revealDelay(200)}
            className="bg-brand absolute top-[1.0625rem] right-[12.5%] left-[12.5%] hidden h-0.5 lg:block"
          />
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <li
                key={s.title}
                data-reveal
                style={revealDelay(i * 150)}
                className="relative flex gap-4 lg:flex-col lg:items-center lg:text-center"
              >
                {/* Garis penghubung vertikal (HP/tablet) */}
                {i < steps.length - 1 ? (
                  <span
                    aria-hidden
                    className="bg-brand absolute top-9 -bottom-8 left-[1.0625rem] w-0.5 lg:hidden"
                  />
                ) : null}
                <span className="bg-brand relative flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold text-white">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="pt-1.5 lg:pt-0">
                  <h3 className="text-brand inline-flex items-center gap-1.5 font-semibold">
                    {s.title}
                    <Icon className="size-4 text-zinc-800" aria-hidden />
                  </h3>
                  <p className="text-muted-foreground mt-1 text-sm lg:mx-auto lg:max-w-[14rem]">
                    {s.desc}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function CallToAction() {
  return (
    <div className="p-3 py-12 sm:p-4 sm:py-16">
      <section
        data-reveal="zoom"
        className="bg-brand-grid flex flex-col items-center rounded-[1.75rem] px-6 py-16 text-center text-white sm:py-24"
      >
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Mulai Ajukan Izin Dispen
        </h2>
        <p className="mt-3 max-w-md text-sm text-pretty text-white/90 sm:text-base">
          Masuk dengan akun sekolahmu dan mulai ajukan atau proses izin secara
          digital
        </p>
        <TransitionLink href={LOGIN_PATH} className={cn(pillWhite, "mt-7")}>
          Masuk ke SisPensi <ArrowRight className="size-4" aria-hidden />
        </TransitionLink>
      </section>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-auto bg-zinc-50">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
        <div
          data-reveal
          className="grid grid-cols-1 gap-x-6 gap-y-10 min-[400px]:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]"
        >
          <div className="min-[400px]:col-span-2 lg:col-span-1">
            <p className="text-brand text-lg font-bold tracking-tight">
              SisPensi
            </p>
            <p className="text-muted-foreground mt-3 max-w-xs text-sm">
              Sistem Perizinan Siswa Digital SMK Telkom Purwokerto. Paperless,
              cepat, dan terverifikasi.
            </p>
          </div>

          {footerLinks.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold">{group.title}</h3>
              <ul className="text-muted-foreground mt-3 text-sm">
                {group.items.map((it) => (
                  <li key={it.label}>
                    {it.href === LOGIN_PATH ? (
                      <TransitionLink
                        href={it.href}
                        className="hover:text-brand inline-flex min-h-11 max-w-full items-center py-2 wrap-anywhere"
                      >
                        {it.label}
                      </TransitionLink>
                    ) : it.href.startsWith("/") ? (
                      <Link
                        href={it.href}
                        className="hover:text-brand inline-flex min-h-11 max-w-full items-center py-2 wrap-anywhere"
                      >
                        {it.label}
                      </Link>
                    ) : (
                      <a
                        href={it.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-brand inline-flex min-h-11 max-w-full items-center py-2 wrap-anywhere"
                      >
                        {it.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-muted-foreground mt-12 text-xs">
          © {currentYear()} SMK Telkom Purwokerto. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
