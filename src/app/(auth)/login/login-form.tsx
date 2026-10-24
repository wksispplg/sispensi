"use client";

import { useActionState, useState } from "react";
import { ArrowLeft, Eye, EyeOff, UserRound } from "lucide-react";

import { login, type LoginState } from "./actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TransitionLink } from "@/components/common/transition-link";

const initialState: LoginState = {};

/** Field abu berbentuk pil sesuai desain halaman login. */
const fieldClass =
  "h-12 md:h-12 rounded-full border-transparent bg-zinc-100 px-5 shadow-none focus-visible:border-brand/40 focus-visible:bg-white focus-visible:ring-brand/15";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div data-fade-on-leave className="w-full max-w-sm">
      <div className="text-center">
        <h1 className="inline-flex items-center gap-2 text-3xl font-semibold tracking-tight">
          Masuk <UserRound className="size-7" aria-hidden />
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Masukkan email dan password yang sesuai
        </p>
      </div>

      <form action={formAction} className="mt-10 flex flex-col gap-5">
        <input type="hidden" name="next" value={next ?? ""} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="px-1">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.email}
            placeholder="nama@smktelkom-pwt.sch.id"
            required
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password" className="px-1">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className={`${fieldClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword ? "Sembunyikan password" : "Tampilkan password"
              }
              aria-pressed={showPassword}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-full outline-none focus-visible:ring-[3px]"
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            aria-expanded={showHelp}
            aria-controls="lupa-password"
            className="text-brand hover:text-brand-dark focus-visible:ring-ring/50 self-end rounded-sm px-1 text-sm font-medium outline-none focus-visible:ring-[3px]"
          >
            Lupa password?
          </button>
          <p
            id="lupa-password"
            hidden={!showHelp}
            className="text-muted-foreground rounded-2xl bg-zinc-100 px-4 py-2.5 text-xs"
          >
            Akun SisPensi dikelola sekolah. Hubungi{" "}
            <span className="text-foreground font-medium">
              Administrator SisPensi
            </span>{" "}
            (bagian Tata Usaha) untuk mereset password Anda.
          </p>
        </div>

        {state.error ? (
          <p
            role="alert"
            className="bg-destructive/10 text-destructive rounded-2xl px-4 py-2.5 text-sm"
          >
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="from-brand to-brand-dark shadow-brand/25 focus-visible:ring-brand/40 mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r text-sm font-semibold text-white shadow-lg transition-[filter,opacity] outline-none hover:brightness-110 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-60"
        >
          {pending ? "Memproses…" : "Login"}
        </button>
      </form>

      <TransitionLink
        href="/"
        className="text-muted-foreground hover:text-foreground mt-6 inline-flex w-full items-center justify-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Kembali ke beranda
      </TransitionLink>
    </div>
  );
}
