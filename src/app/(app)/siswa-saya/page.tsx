import Form from "next/form";
import { Users } from "lucide-react";

import { StaffEmpty, StaffError } from "@/features/approvals/staff-widgets";
import { requireRole } from "@/lib/auth";
import { ROLES, TEACHER_STUDENTS_PATH } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";

export default async function TeacherStudentsPage({ searchParams }: {
  searchParams: Promise<{ kelas?: string | string[] }>;
}) {
  const teacher = await requireRole(ROLES.GURU_MAPEL, ROLES.WALI_KELAS);
  const { kelas } = await searchParams;
  const supabase = await createClient();
  const assigned = `homeroom_teacher_id.eq.${teacher.id},teaching.not.is.null`;
  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, name, homeroom_teacher_id, teaching:schedules()")
    .eq("teaching.teacher_id", teacher.id)
    .or(assigned)
    .order("name")
    .order("id");

  if (classesError) return <StaffError>Daftar kelas belum dapat dimuat. Silakan muat ulang halaman.</StaffError>;
  const selectedClass = classes.find((item) => item.id === kelas)
    ?? classes.find((item) => item.homeroom_teacher_id === teacher.id)
    ?? classes[0];
  if (!selectedClass) {
    return <section className="app-panel"><StaffEmpty title="Belum ada kelas yang diampu" description="Kelas akan muncul setelah penugasan mengajar atau wali kelas tercatat." /></section>;
  }

  // Periksa lagi penugasan di query daftar siswa karena client server ini melewati RLS.
  const { data: roster, error: rosterError } = await createAdminClient()
    .from("classes")
    .select("teaching:schedules(), students:profiles!profiles_class_id_fkey(id, full_name)")
    .eq("id", selectedClass.id)
    .eq("teaching.teacher_id", teacher.id)
    .or(assigned)
    .eq("students.role", ROLES.SISWA)
    .order("full_name", { referencedTable: "students", nullsFirst: false })
    .order("id", { referencedTable: "students" })
    .maybeSingle();

  return (
    <section className="app-panel flex flex-col gap-5 p-5 sm:p-7" aria-labelledby="teacher-student-list">
      <Form action={TEACHER_STUDENTS_PATH} className="flex flex-wrap items-end gap-2">
        <div className="w-full min-w-0 sm:max-w-xs">
          <Label htmlFor="roster-class" className="mb-1.5">Pilih kelas</Label>
          <SelectNative key={selectedClass.id} id="roster-class" name="kelas" defaultValue={selectedClass.id}>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}{item.homeroom_teacher_id === teacher.id ? " (Wali Kelas)" : ""}</option>)}
          </SelectNative>
        </div>
        <Button type="submit" variant="outline">Tampilkan</Button>
      </Form>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <h2 id="teacher-student-list" className="flex items-center gap-2 text-base font-semibold"><Users className="size-4 shrink-0" aria-hidden />{selectedClass.name}</h2>
        {roster && <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs tabular-nums text-zinc-700">{roster.students.length.toLocaleString("id-ID")} siswa</span>}
      </div>
      {rosterError ? <StaffError>Daftar siswa belum dapat dimuat. Silakan muat ulang halaman.</StaffError> : !roster ? (
        <StaffEmpty title="Kelas sudah tidak tersedia" description="Muat ulang halaman untuk melihat kelas yang masih Anda ampu." />
      ) : roster.students.length ? (
        <ol className="grid list-inside list-decimal gap-2 sm:grid-cols-2">
          {roster.students.map((student) => <li key={student.id} className="min-w-0 rounded-lg bg-zinc-50 px-4 py-3 text-sm wrap-anywhere marker:text-zinc-500">{student.full_name?.trim() || "Nama belum diisi"}</li>)}
        </ol>
      ) : <StaffEmpty title="Belum ada siswa di kelas ini" />}
    </section>
  );
}
