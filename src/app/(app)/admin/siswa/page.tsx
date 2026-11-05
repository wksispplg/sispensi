import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { ADMIN_HOME_PATH, ROLES } from "@/lib/constants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DeleteButton } from "@/components/common/delete-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiswaForm } from "./siswa-form";
import { ImportForm } from "./import-form";
import { deleteStudent } from "./actions";

const PAGE_SIZE = 50;

export default async function AdminSiswaPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  await requireRole(ROLES.ADMIN);
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const requestedPage = Number(params.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageHref = (target: number) => {
    const values = new URLSearchParams({ page: String(target) });
    if (query) values.set("q", query);
    return `/admin/siswa?${values}`;
  };

  const supabase = await createClient();
  let studentQuery = supabase
    .from("profiles")
    .select("id, full_name, nis, class_id", { count: "exact" })
    .eq("role", "siswa");
  // Jangan izinkan tanda pemisah filter PostgREST dari isian pencarian.
  const search = query.replace(/[^\p{L}\p{N}\s-]/gu, " ").trim();
  if (search) studentQuery = studentQuery.or(`full_name.ilike.%${search}%,nis.ilike.%${search}%`);
  const [studentsRes, classesRes] = await Promise.all([
    studentQuery.order("full_name").order("id").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from("classes").select("id, name").order("name"),
  ]);
  if (studentsRes.error || classesRes.error) throw new Error("Daftar siswa belum dapat dimuat. Silakan coba lagi.");

  const students = studentsRes.data ?? [];
  const total = studentsRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > totalPages) redirect(pageHref(totalPages));
  const classes = classesRes.data ?? [];
  const classMap = new Map(classes.map((c) => [c.id, c.name] as const));

  const admin = createAdminClient();
  const emailMap = new Map<string, string>();
  const wantedIds = new Set(students.map((student) => student.id));
  // Auth memiliki paginasi tersendiri; email siswa setelah akun ke-1.000 juga harus terbaca.
  for (let authPage = 1; emailMap.size < wantedIds.size; authPage++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: authPage, perPage: 1000 });
    if (error) throw new Error("Email siswa belum dapat dimuat. Silakan coba lagi.");
    for (const user of data.users) {
      if (wantedIds.has(user.id)) emailMap.set(user.id, user.email ?? "");
    }
    if (data.users.length < 1000) break;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={ADMIN_HOME_PATH}
          className="text-muted-foreground hover:text-foreground mb-2 inline-flex w-fit items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> Data Master
        </Link>
        <h1 className="staff-page-title text-2xl font-semibold tracking-tight">Siswa</h1>
        <p className="staff-page-description text-muted-foreground">
          Kelola akun siswa atau impor massal dari Excel/CSV.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Impor dari Excel / CSV</CardTitle>
          <CardDescription>
            Kolom: <code>nama</code>, <code>email</code> (wajib); <code>kelas</code>,{" "}
            <code>nis</code>, <code>password</code> (opsional). Kelas dicocokkan
            berdasarkan nama (dibuat otomatis bila belum ada). Tanpa password →
            memakai NIS, atau <code>sipensi123</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ImportForm />
          <a
            href="/templates/import-siswa.csv"
            download
            className="text-primary inline-flex w-fit items-center gap-1 text-sm hover:underline"
          >
            <Download className="size-4" /> Unduh template CSV
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tambah Siswa (satuan)</CardTitle>
        </CardHeader>
        <CardContent>
          <SiswaForm classes={classes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Daftar Siswa ({total.toLocaleString("id-ID")})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action="/admin/siswa" method="get" className="mb-5 flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 sm:max-w-sm">
              <label htmlFor="student-search" className="mb-1 block text-sm">Cari nama atau NIS</label>
              <Input id="student-search" name="q" defaultValue={query} placeholder="Masukkan nama atau NIS" maxLength={100} />
            </div>
            <Button type="submit" variant="outline">Cari</Button>
            {query && <Button variant="ghost" asChild><Link href="/admin/siswa">Reset</Link></Button>}
          </form>
          {students.length === 0 ? (
            <p className="text-muted-foreground text-sm">{query ? "Tidak ada siswa yang cocok." : "Belum ada siswa."}</p>
          ) : (
            <ul className="divide-y">
              {students.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center gap-3 py-3"
                >
                  <div className="min-w-0 flex-1 basis-full wrap-anywhere sm:min-w-40 sm:basis-auto">
                    <p className="font-medium">{s.full_name ?? "—"}</p>
                    <p className="text-muted-foreground text-xs">
                      {emailMap.get(s.id) ?? ""}
                      {s.nis ? ` · NIS ${s.nis}` : ""}
                    </p>
                  </div>
                  <span className="text-muted-foreground text-sm">
                    {s.class_id ? (classMap.get(s.class_id) ?? "—") : "Tanpa kelas"}
                  </span>
                  <DeleteButton
                    id={s.id}
                    action={deleteStudent}
                    confirmText={`Hapus akun ${s.full_name ?? "siswa"}? Akun & profil dihapus permanen.`}
                  />
                </li>
              ))}
            </ul>
          )}
          {total > 0 && (
            <nav aria-label="Halaman daftar siswa" className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-muted-foreground text-sm">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} dari {total.toLocaleString("id-ID")} siswa · Halaman {page} dari {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 && <Button variant="outline" size="sm" asChild><Link href={pageHref(page - 1)}>Sebelumnya</Link></Button>}
                {page < totalPages && <Button variant="outline" size="sm" asChild><Link href={pageHref(page + 1)}>Berikutnya</Link></Button>}
              </div>
            </nav>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
