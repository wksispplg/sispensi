import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTsLoader } from "./helpers/load-ts.mjs";

// Jumlah ini sengaja melewati batas 1.000 baris Supabase dan 1.000 akun Auth.
const students = Array.from({ length: 1002 }, (_, index) => ({
  id: `student-${index}`,
  full_name: `Siswa ${String(index).padStart(4, "0")}`,
  nis: String(990000000 + index),
  class_id: index === 0 ? "class-2" : "class-1",
}));
const users = students.map(row => ({ id: row.id, email: `${row.nis}@example.com` }));

function environment({ allowed = true, failed = false } = {}) {
  const reads = [], authPages = [];
  const client = { from(table) {
    const read = { table, filters: [], orders: [], range: null };
    reads.push(read);
    const query = {
      select(fields, options) { read.fields = fields; read.count = options?.count; return query; },
      eq(field, value) { read.filters.push([field, value]); return query; },
      in(field, values) { read.filters.push([field, values]); return query; },
      or(value) { read.search = value; return query; },
      order(field) { read.orders.push(field); return query; },
      range(start, end) { read.range = [start, end]; return query; },
      then(resolve) {
        let filtered = students;
        if (read.search) {
          const term = read.search.match(/full_name\.ilike\.%(.*?)%/)[1];
          filtered = students.filter(row => row.full_name.includes(term) || row.nis.includes(term));
        }
        const classFilter = read.filters.find(([field]) => field === "class_id")?.[1];
        if (classFilter) filtered = filtered.filter((row) => [classFilter].flat().includes(row.class_id));
        const data = table === "classes" ? [
          { id: "class-1", name: "X PPLG 1", major: null },
          { id: "class-2", name: "XI TJKT 1", major: "TJKT" },
        ] : filtered.slice(read.range[0], read.range[1] + 1);
        return Promise.resolve({ data, count: filtered.length, error: failed ? { code: "unavailable" } : null }).then(resolve);
      },
    };
    return query;
  } };
  const loader = createTsLoader({
    "next/form": (props) => React.createElement("form", props),
    "next/link": { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) },
    "next/navigation": { redirect: href => { throw new Error(`redirect:${href}`); } },
    "@/lib/auth": { requireRole: async role => { assert.equal(role, "admin"); if (!allowed) throw new Error("forbidden"); } },
    "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/supabase/admin": { createAdminClient: () => ({ auth: { admin: { listUsers: async ({ page, perPage }) => {
      authPages.push(page);
      return { data: { users: users.slice((page - 1) * perPage, page * perPage) }, error: null };
    } } } }) },
    "./siswa-form": { SiswaForm: () => null },
    "./import-form": { ImportForm: () => null },
    "./actions": { deleteStudent: async () => {} },
    "@/components/common/delete-button": { DeleteButton: () => null },
  });
  const Page = loader("src/app/(app)/admin/siswa/page").default;
  return { reads, authPages, render: async params => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) })) };
}

test("halaman terakhir memuat siswa dan email setelah urutan ke-1.000", async () => {
  const env = environment();
  const html = await env.render({ page: "21" });
  assert.match(html, /Daftar Siswa \(1\.002\)/);
  assert.match(html, /Siswa 1000/);
  assert.match(html, /Siswa 1001/);
  assert.match(html, /990001001@example\.com/);
  assert.doesNotMatch(html, /Siswa 0000/);
  assert.equal((html.match(/<li /g) ?? []).length, 2);
  assert.deepEqual(env.authPages, [1, 2]);
  const read = env.reads.find(row => row.table === "profiles");
  assert.deepEqual(read.range, [1000, 1049]);
  assert.deepEqual(read.orders, ["full_name", "id"]);
  assert.deepEqual(read.filters, [["role", "siswa"]]);
  assert.equal(read.count, "exact");
  assert.doesNotMatch(html, />Berikutnya</);
});

test("pencarian NIS menemukan akun di luar 1.000 siswa pertama", async () => {
  const env = environment();
  const html = await env.render({ q: "990001001" });
  assert.match(html, /Daftar Siswa \(1\)/);
  assert.match(html, /Siswa 1001/);
  assert.match(html, /990001001@example\.com/);
  assert.deepEqual(env.reads.find((read) => read.table === "profiles").range, [0, 49]);
});

test("tautan antarhalaman mempertahankan pencarian dan halaman tidak valid diperbaiki", async () => {
  const env = environment();
  const html = await env.render({ q: "Siswa", page: "2" });
  assert.match(html, /page=1&amp;q=Siswa/);
  assert.match(html, /page=3&amp;q=Siswa/);
  await assert.rejects(environment().render({ page: "999" }), /redirect:\/admin\/siswa\?page=21/);
});

test("akses selain admin ditolak sebelum membaca daftar siswa atau Auth", async () => {
  const env = environment({ allowed: false });
  await assert.rejects(env.render({}), /forbidden/);
  assert.equal(env.reads.length, 0);
  assert.equal(env.authPages.length, 0);
});

test("kegagalan database ditampilkan sebagai kegagalan memuat, bukan daftar kosong", async () => {
  await assert.rejects(environment({ failed: true }).render({}), /Daftar siswa belum dapat dimuat/);
});

test("filter jurusan dan kelas berlaku sebelum paginasi dan tetap ada saat membuka Edit", async () => {
  const byMajor = environment();
  const legacy = await byMajor.render({ jurusan: "PPLG", q: "Siswa" });
  assert.deepEqual(byMajor.reads.find((read) => read.table === "profiles").filters.at(-1), ["class_id", ["class-1"]]);
  assert.match(legacy, /Daftar Siswa \(1\.001\)/);
  assert.doesNotMatch(legacy, /Siswa 0000/);
  assert.match(legacy, /page=2&amp;q=Siswa&amp;jurusan=PPLG/);

  const byClass = environment();
  const html = await byClass.render({ jurusan: "TJKT", kelas: "class-2", q: "0000" });
  assert.deepEqual(byClass.reads.find((read) => read.table === "profiles").filters.at(-1), ["class_id", "class-2"]);
  assert.match(html, /Daftar Siswa \(1\)/);
  assert.match(html, /student-0\/edit\?page=1&amp;q=0000&amp;jurusan=TJKT&amp;kelas=class-2/);
});

const studentId = "10000000-0000-4000-8000-000000000001";
const classId = "20000000-0000-4000-8000-000000000001";
const updatedAt = "2026-11-05T01:00:00.123Z";
const originalEmail = "siswa@example.com";

function editEnvironment({ admin = true, student = true, error = null, currentEmail = originalEmail } = {}) {
  const writes = [], filters = [], invalidations = [];
  let authCalls = 0;
  const loader = createTsLoader({
    "next/cache": { revalidatePath: (path) => invalidations.push(path) },
    "@/lib/auth": { getProfile: async () => ({ role: admin ? "admin" : "guru_mapel" }) },
    "@/lib/supabase/server": { createClient: async () => ({
      from(table) {
        assert.equal(table, "profiles");
        const query = {
          update(values) { writes.push(values); return query; },
          eq(column, value) { filters.push([column, value]); return query; },
          select() { return query; },
          async maybeSingle() { return { data: student ? { id: studentId } : null, error }; },
        };
        return query;
      },
    }) },
    "@/lib/supabase/admin": { createAdminClient: () => {
      authCalls++;
      return { auth: { admin: {
        async getUserById() { return { data: { user: { email: currentEmail } }, error: null }; },
        async updateUserById(id, attributes) {
          assert.equal(id, studentId);
          writes.push(attributes);
          return { data: { user: { id } }, error: null };
        },
      } } };
    } },
  });
  const { updateStudentProfile, updateStudentLogin } = loader("src/app/(app)/admin/siswa/actions");
  const fields = (values) => {
    const form = new FormData();
    for (const [name, value] of Object.entries(values)) form.set(name, value);
    return form;
  };
  return {
    writes, filters, invalidations, authCalls: () => authCalls,
    saveProfile: () => updateStudentProfile(studentId, updatedAt, {}, fields({ full_name: " Siswa Baru ", nis: "00123", class_id: classId })),
    saveLogin: (email, password) => updateStudentLogin(studentId, originalEmail, {}, fields({ email, password })),
  };
}

test("edit profil mempertahankan nol di awal NIS, membatasi akun siswa, dan menolak data yang sudah berubah", async () => {
  const env = editEnvironment();
  assert.deepEqual(await env.saveProfile(), { ok: true });
  assert.deepEqual(env.writes, [{ full_name: "Siswa Baru", nis: "00123", class_id: classId }]);
  assert.deepEqual(env.filters, [["id", studentId], ["role", "siswa"], ["updated_at", updatedAt]]);
  assert.equal(env.authCalls(), 0);
  assert.match((await editEnvironment({ student: false }).saveProfile()).error, /sudah berubah/);
  assert.match((await editEnvironment({ error: { code: "23505" } }).saveProfile()).error, /NIS sudah dipakai/);
});

test("reset password atau ubah email hanya mengirim perubahan akun yang diminta", async () => {
  const env = editEnvironment();
  assert.deepEqual(await env.saveLogin(originalEmail, "UjiBaru123!"), { ok: true });
  assert.deepEqual(await env.saveLogin("baru@example.com", ""), { ok: true });
  assert.deepEqual(env.writes, [{ password: "UjiBaru123!" }, { email: "baru@example.com", email_confirm: true }]);
  assert.ok(env.invalidations.includes("/admin/siswa"));

  const stale = editEnvironment({ currentEmail: "lain@example.com" });
  assert.match((await stale.saveLogin("baru@example.com", "")).error, /Email siswa sudah berubah/);
  assert.deepEqual(stale.writes, []);
  for (const options of [{ admin: false }, { student: false }]) {
    const blocked = editEnvironment(options);
    assert.ok((await blocked.saveLogin(originalEmail, "UjiBaru123!")).error);
    assert.equal(blocked.authCalls(), 0);
  }
});
