import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, CalendarClock } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { ADMIN_SCHEDULES_PATH, DAY_LABELS, LESSON_PERIODS, ROLES } from "@/lib/constants";
import { lessonPeriodLabel } from "@/features/izin/lesson-periods";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";
import { SubjectForm } from "./subject-form";
import { ScheduleForm } from "./schedule-form";
import { DeleteButton } from "@/components/common/delete-button";
import { deleteSchedule, deleteSubject } from "./actions";

const PAGE_SIZE = 10;

export default async function AdminJadwalPage({ searchParams }: {
  searchParams: Promise<{ kelas?: string | string[]; page?: string | string[] }>;
}) {
  await requireRole(ROLES.ADMIN);
  const params = await searchParams;
  const requestedPage = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isInteger(requestedPage) && requestedPage > 0 && Number.isSafeInteger(requestedPage * PAGE_SIZE) ? requestedPage : 1;

  const supabase = await createClient();
  const classesPromise = supabase.from("classes").select("id, name").order("name").order("id").then((result) => {
    if (result.error) throw new Error("Daftar kelas belum dapat dimuat.");
    return result.data ?? [];
  });
  const selectionPromise = classesPromise.then(async (classes) => {
    const selectedClass = classes.find((klass) => klass.id === params.kelas) ?? classes[0];
    if (!selectedClass) return { selectedClass, schedulesRes: null };
    const schedulesRes = await supabase
      .from("schedules")
      .select("id, subject_id, teacher_id, day_of_week, start_time, end_time", { count: "exact" })
      .eq("class_id", selectedClass.id)
      .order("day_of_week")
      .order("start_time")
      .order("id")
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    return { selectedClass, schedulesRes };
  });

  const [classes, subjectsRes, teachersRes, { selectedClass, schedulesRes }] =
    await Promise.all([
      classesPromise,
      supabase.from("subjects").select("id, name, code").order("name"),
      supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("role", [ROLES.GURU_MAPEL, ROLES.WALI_KELAS, ROLES.GURU_BK])
        .order("full_name"),
      selectionPromise,
    ]);

  const pageHref = (target: number) => `${ADMIN_SCHEDULES_PATH}?${new URLSearchParams({ kelas: selectedClass?.id ?? "", page: String(target) })}`;
  // Halaman di luar rentang dapat terjadi setelah jadwal terakhir di halaman itu dihapus.
  if (selectedClass && page > 1 && schedulesRes?.error?.code === "PGRST103") {
    const result = await supabase.from("schedules").select("id", { count: "exact", head: true }).eq("class_id", selectedClass.id);
    if (result.error) throw new Error("Jadwal pelajaran belum dapat dimuat.");
    const lastPage = Math.max(1, Math.ceil((result.count ?? 0) / PAGE_SIZE));
    redirect(pageHref(lastPage < page ? lastPage : 1));
  }
  if (schedulesRes?.error || subjectsRes.error || teachersRes.error) {
    throw new Error("Jadwal pelajaran belum dapat dimuat.");
  }

  const total = schedulesRes?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (selectedClass && page > totalPages) redirect(pageHref(totalPages));
  const subjects = subjectsRes.data ?? [];
  const teachers = (teachersRes.data ?? []).map((t) => ({
    id: t.id,
    name: t.full_name ?? "Guru",
  }));
  const schedules = schedulesRes?.data ?? [];

  const subjectMap = new Map(subjects.map((s) => [s.id, s.name] as const));
  const teacherMap = new Map(teachers.map((t) => [t.id, t.name] as const));

  return (
    <div className="flex flex-col gap-6">
      <Card id="daftar-jadwal">
        <CardHeader>
          <CardTitle className="text-base">Daftar Jadwal Pelajaran</CardTitle>
          <CardDescription>Jadwal menentukan guru penanggung jawab pada Lapis 1.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedClass ? (
            <>
              <Form action={ADMIN_SCHEDULES_PATH} className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 w-full sm:max-w-xs">
                  <Label htmlFor="schedule-class" className="mb-1.5">Pilih kelas</Label>
                  <SelectNative key={selectedClass.id} id="schedule-class" name="kelas" defaultValue={selectedClass.id}>
                    {classes.map((klass) => <option key={klass.id} value={klass.id}>{klass.name}</option>)}
                  </SelectNative>
                </div>
                <Button type="submit" variant="outline">Tampilkan</Button>
              </Form>
              <details className="rounded-xl border border-zinc-200 px-3 py-2 text-sm">
                <summary className="cursor-pointer py-1 font-medium">Patokan jam mapel (1–11)</summary>
                <ul className="grid gap-2 pt-2 pb-1 text-xs tabular-nums sm:grid-cols-2 xl:grid-cols-3">
                  {LESSON_PERIODS.map((period) => <li key={period.number}>{lessonPeriodLabel(period.number)}</li>)}
                </ul>
              </details>
              <h2 className="text-sm font-semibold">Jadwal {selectedClass.name}</h2>
              {schedules.length ? (
                <ul className="divide-y border-y">
                  {schedules.map((schedule) => {
                    const start = schedule.start_time.slice(0, 5);
                    const end = schedule.end_time.slice(0, 5);
                    const first = LESSON_PERIODS.find((period) => period.start === start);
                    const last = LESSON_PERIODS.find((period) => period.end === end);
                    const periodLabel = first && last
                      ? `Jam ke-${first.number}${first.number === last.number ? "" : `–${last.number}`}`
                      : "Jam khusus";
                    return (
                      <li key={schedule.id} className="flex items-center gap-3 py-3 text-sm">
                        <div className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] gap-2 sm:grid-cols-[5rem_9rem_minmax(0,1fr)] sm:items-center sm:gap-3">
                          <p className="font-medium">{DAY_LABELS[schedule.day_of_week]}</p>
                          <div className="tabular-nums">
                            <p className="font-semibold">{periodLabel}</p>
                            <p className="text-muted-foreground text-xs">{start.replace(":", ".")}–{end.replace(":", ".")} WIB</p>
                          </div>
                          <div className="col-span-2 min-w-0 wrap-anywhere sm:col-auto">
                            <p className="font-medium">{schedule.subject_id ? subjectMap.get(schedule.subject_id) ?? "—" : "—"}</p>
                            <p className="text-muted-foreground text-xs">{schedule.teacher_id ? teacherMap.get(schedule.teacher_id) ?? "—" : "—"}</p>
                          </div>
                        </div>
                        <DeleteButton id={schedule.id} action={deleteSchedule} confirmText="Hapus jadwal ini?" />
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="text-muted-foreground text-sm">Belum ada jadwal untuk kelas ini.</p>}
              {total > 0 && (
                <nav aria-label="Halaman daftar jadwal" className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-muted-foreground text-sm">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} dari {total} jadwal · Halaman {page} dari {totalPages}</p>
                  <div className="flex flex-wrap gap-2">
                    {page > 1 && <Button variant="outline" size="sm" asChild><Link href={`${pageHref(page - 1)}#daftar-jadwal`}>Sebelumnya</Link></Button>}
                    {page < totalPages && <Button variant="outline" size="sm" asChild><Link href={`${pageHref(page + 1)}#daftar-jadwal`}>Berikutnya</Link></Button>}
                  </div>
                </nav>
              )}
            </>
          ) : <p className="text-muted-foreground text-sm">Belum ada kelas. Tambahkan kelas melalui Data Master.</p>}
        </CardContent>
      </Card>

      {/* Mata pelajaran */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-4" /> Mata Pelajaran
          </CardTitle>
          <CardDescription>
            Tambahkan mata pelajaran sebelum menyusun jadwal.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SubjectForm />
          {subjects.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {subjects.map((s) => (
                <li
                  key={s.id}
                  className="bg-muted flex items-center gap-1 rounded-md py-1 pr-1 pl-3 text-sm"
                >
                  <span>
                    {s.name}
                    {s.code ? (
                      <span className="text-muted-foreground"> ({s.code})</span>
                    ) : null}
                  </span>
                  <DeleteButton
                    id={s.id}
                    action={deleteSubject}
                    confirmText={`Hapus mapel "${s.name}"?`}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              Belum ada mata pelajaran.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tambah jadwal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4" /> Tambah Jadwal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScheduleForm
            classes={classes}
            subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
            teachers={teachers}
          />
        </CardContent>
      </Card>
    </div>
  );
}
