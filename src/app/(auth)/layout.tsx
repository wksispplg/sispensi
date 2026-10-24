import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh flex-1 flex-col bg-white">{children}</main>
  );
}
