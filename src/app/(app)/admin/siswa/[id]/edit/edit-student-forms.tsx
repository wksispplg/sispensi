"use client";

import { useFormAction } from "@/hooks/use-form-action";
import type { Profile } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";
import { updateStudentLogin, updateStudentProfile, type FormState } from "../../actions";

const initialState: FormState = {};

export function EditStudentForms({ student, classes, email }: {
  student: Pick<Profile, "id" | "full_name" | "nis" | "class_id" | "updated_at">;
  classes: { id: string; name: string }[];
  email: string | null;
}) {
  const [state, formProps, pending] = useFormAction(updateStudentProfile.bind(null, student.id, student.updated_at), initialState);

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <form {...formProps} className="grid min-w-0 gap-3 rounded-xl border p-4 sm:p-5">
        <h2 className="text-sm font-semibold">Data Siswa</h2>
        <div className="grid gap-2">
          <Label htmlFor="edit-student-name">Nama</Label>
          <Input id="edit-student-name" name="full_name" required maxLength={100} defaultValue={student.full_name ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-student-nis">NIS</Label>
          <Input id="edit-student-nis" name="nis" inputMode="numeric" maxLength={30} defaultValue={student.nis ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-student-class">Kelas</Label>
          <SelectNative id="edit-student-class" name="class_id" defaultValue={student.class_id ?? ""}>
            <option value="">Tanpa kelas</option>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </SelectNative>
        </div>
        {state.error && <p role="alert" className="text-destructive text-sm">{state.error}</p>}
        {state.ok && <p role="status" className="text-sm text-emerald-700">Data siswa berhasil disimpan.</p>}
        <Button type="submit" disabled={pending} className="w-fit">{pending ? "Menyimpan…" : "Simpan Data Siswa"}</Button>
      </form>
      {email === null ? (
        <p role="alert" className="text-destructive rounded-xl border p-4 text-sm">Informasi akun login belum dapat dimuat. Muat ulang halaman untuk mengatur email atau password.</p>
      ) : <StudentLoginForm id={student.id} email={email} />}
    </div>
  );
}

function StudentLoginForm({ id, email }: { id: string; email: string }) {
  const [state, formProps, pending] = useFormAction(updateStudentLogin.bind(null, id, email), initialState);

  return (
    <form {...formProps} className="grid min-w-0 gap-3 rounded-xl border p-4 sm:p-5">
      <h2 className="text-sm font-semibold">Akun Login</h2>
      <div className="grid gap-2">
        <Label htmlFor="edit-student-email">Email</Label>
        <Input id="edit-student-email" name="email" type="email" autoComplete="off" defaultValue={email} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="new-student-password">Password baru</Label>
        <Input id="new-student-password" name="password" type="password" autoComplete="new-password" minLength={6} aria-describedby="student-password-help" />
        <p id="student-password-help" className="text-muted-foreground text-xs">Isi minimal 6 karakter untuk mereset password. Biarkan kosong jika hanya mengubah email.</p>
      </div>
      {state.error && <p role="alert" className="text-destructive text-sm">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-emerald-700">Pengaturan login berhasil disimpan.</p>}
      <Button type="submit" disabled={pending} className="w-fit">{pending ? "Menyimpan…" : "Simpan Akun Login"}</Button>
    </form>
  );
}
