import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { ADMIN_STUDENTS_PATH, ROLES } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EditStudentForms } from "./edit-student-forms";

export default async function EditStudentPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; q?: string; kelas?: string; jurusan?: string }>;
}) {
  await requireRole(ROLES.ADMIN);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const [studentResult, classesResult] = await Promise.all([
    supabase.from("profiles").select("id, full_name, nis, class_id, updated_at").eq("id", id).eq("role", ROLES.SISWA).maybeSingle(),
    supabase.from("classes").select("id, name").order("name"),
  ]);
  if (studentResult.error || classesResult.error) throw new Error("Data siswa belum dapat dimuat.");
  if (!studentResult.data) notFound();

  const { data, error } = await createAdminClient().auth.admin.getUserById(id);
  const list = await searchParams;
  const { page, q, kelas, jurusan } = list;

  return (
    <div className="flex flex-col gap-6">
      <Link href={{ pathname: ADMIN_STUDENTS_PATH, query: { page, q, kelas, jurusan }, hash: "daftar-siswa" }} className="text-muted-foreground hover:text-foreground inline-flex min-h-9 w-fit items-center gap-2 text-sm">
        <ArrowLeft className="size-4" aria-hidden /> Kembali ke Daftar Siswa
      </Link>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{studentResult.data.full_name || "Edit siswa"}</CardTitle>
          <CardDescription>Perbarui profil siswa atau pengaturan akun loginnya.</CardDescription>
        </CardHeader>
        <CardContent>
          <EditStudentForms student={studentResult.data} classes={classesResult.data} email={error || !data.user ? null : (data.user.email ?? "")} />
        </CardContent>
      </Card>
    </div>
  );
}
