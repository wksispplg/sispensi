import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import {
  ADMIN_HOME_PATH,
  ALL_ROLES,
  APPROVER_ROLES,
  ROLE_LABELS,
  ROLES,
} from "@/lib/constants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DeleteButton } from "@/components/common/delete-button";
import { InlineSelect } from "@/components/common/inline-select";
import { GuruForm } from "./guru-form";
import { ImportForm } from "./import-form";
import { deleteUser, setUserRole } from "./actions";

export default async function AdminGuruPage() {
  await requireRole(ROLES.ADMIN);

  const supabase = await createClient();
  const { data: teachers, error: teachersError } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("role", [...APPROVER_ROLES])
    .order("full_name");
  if (teachersError) throw new Error("Daftar guru belum dapat dimuat. Silakan coba lagi.");

  const admin = createAdminClient();
  const emailMap = new Map<string, string>();
  const wantedIds = new Set((teachers ?? []).map((teacher) => teacher.id));
  for (let page = 1; emailMap.size < wantedIds.size; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("Email guru belum dapat dimuat. Silakan coba lagi.");
    for (const user of data.users) {
      if (wantedIds.has(user.id)) emailMap.set(user.id, user.email ?? "");
    }
    if (data.users.length < 1000) break;
  }

  const roleOptions = ALL_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));
  const list = teachers ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={ADMIN_HOME_PATH}
          className="text-muted-foreground hover:text-foreground mb-2 inline-flex w-fit items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> Data Master
        </Link>
        <h1 className="staff-page-title text-2xl font-semibold tracking-tight">Guru</h1>
        <p className="staff-page-description text-muted-foreground">
          Buat akun guru dan atur perannya.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Impor dari Excel / CSV</CardTitle>
          <CardDescription>
            Kolom: <code>nama</code>, <code>email</code> (wajib); <code>role</code>{" "}
            (guru_mapel / wali_kelas / guru_bk — default guru_mapel);{" "}
            <code>password</code> (opsional, default <code>sipensi123</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ImportForm />
          <a
            href="/templates/import-guru.csv"
            download
            className="text-primary inline-flex w-fit items-center gap-1 text-sm hover:underline"
          >
            <Download className="size-4" /> Unduh template CSV
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tambah Guru (satuan)</CardTitle>
        </CardHeader>
        <CardContent>
          <GuruForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Guru ({list.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-muted-foreground text-sm">Belum ada guru.</p>
          ) : (
            <ul className="divide-y">
              {list.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center gap-3 py-3"
                >
                  <div className="min-w-0 flex-1 basis-full wrap-anywhere sm:min-w-40 sm:basis-auto">
                    <p className="font-medium">{t.full_name ?? "—"}</p>
                    <p className="text-muted-foreground text-xs">
                      {emailMap.get(t.id) ?? ""}
                    </p>
                  </div>
                  <InlineSelect
                    id={t.id}
                    value={t.role}
                    options={roleOptions}
                    action={setUserRole}
                  />
                  <DeleteButton
                    id={t.id}
                    action={deleteUser}
                    confirmText={`Hapus akun ${t.full_name ?? "guru"}? Akun & profil akan dihapus permanen.`}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
