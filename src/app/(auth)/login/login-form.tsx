"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, GraduationCap } from "lucide-react";

import { login, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initialState: LoginState = {};

export function LoginForm({ as, next }: { as?: string; next?: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const heading =
    as === "siswa"
      ? "Masuk sebagai Siswa"
      : as === "pengajar"
        ? "Masuk sebagai Pengajar"
        : "Masuk ke SIPENSI";

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="bg-brand text-brand-foreground mx-auto mb-2 flex size-11 items-center justify-center rounded-xl">
          <GraduationCap className="size-6" />
        </div>
        <CardTitle className="text-xl">{heading}</CardTitle>
        <CardDescription>
          Sistem Perizinan Siswa Digital
          <br />
          SMK Telkom Purwokerto
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next ?? ""} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={state.email}
              placeholder="nama@smktelkom-pwt.sch.id"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password">Password</Label>
              <button
                type="button"
                onClick={() => setShowHelp((v) => !v)}
                aria-expanded={showHelp}
                aria-controls="lupa-password"
                className="text-brand hover:text-brand-dark focus-visible:ring-ring/50 rounded-sm text-sm font-medium outline-none focus-visible:ring-[3px]"
              >
                Lupa password?
              </button>
            </div>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={
                  showPassword ? "Sembunyikan password" : "Tampilkan password"
                }
                aria-pressed={showPassword}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md outline-none focus-visible:ring-[3px]"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            <p
              id="lupa-password"
              hidden={!showHelp}
              className="bg-muted text-muted-foreground rounded-md px-3 py-2 text-xs"
            >
              Akun SIPENSI dikelola sekolah. Hubungi{" "}
              <span className="text-foreground font-medium">
                Administrator SIPENSI
              </span>{" "}
              (bagian Tata Usaha) untuk mereset password Anda.
            </p>
          </div>

          {state.error ? (
            <p
              role="alert"
              className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm"
            >
              {state.error}
            </p>
          ) : null}

          <Button
            type="submit"
            className="bg-brand text-brand-foreground hover:bg-brand-dark w-full"
            disabled={pending}
          >
            {pending ? "Memproses…" : "Masuk"}
          </Button>
        </form>

        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mt-4 inline-flex w-full items-center justify-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> Kembali ke beranda
        </Link>
      </CardContent>
    </Card>
  );
}
