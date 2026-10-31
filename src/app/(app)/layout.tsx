import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getProfile, getSessionUser } from "@/lib/auth";
import { LOGIN_PATH } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/app-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect(LOGIN_PATH); // pengaman; umumnya sudah ditangani proxy

  const profile = await getProfile();
  if (!profile) return <AccountNotProvisioned email={user.email ?? ""} />;

  return (
    <AppShell profile={profile}>
      {children}
    </AppShell>
  );
}

function AccountNotProvisioned({ email }: { email: string }) {
  return (
    <main className="flex min-h-svh flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Akun belum aktif</CardTitle>
          <CardDescription>
            Akun <span className="font-medium">{email}</span> berhasil masuk,
            tetapi belum memiliki profil/role di SIPENSI. Hubungi Administrator
            untuk mengaktifkan akun Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline">
              Keluar
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
