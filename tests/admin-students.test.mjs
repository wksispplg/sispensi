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
  class_id: "class-1",
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
      or(value) { read.search = value; return query; },
      order(field) { read.orders.push(field); return query; },
      range(start, end) { read.range = [start, end]; return query; },
      then(resolve) {
        let filtered = students;
        if (read.search) {
          const term = read.search.match(/full_name\.ilike\.%(.*?)%/)[1];
          filtered = students.filter(row => row.full_name.includes(term) || row.nis.includes(term));
        }
        const data = table === "classes" ? [{ id: "class-1", name: "X PPLG 1" }] : filtered.slice(read.range[0], read.range[1] + 1);
        return Promise.resolve({ data, count: filtered.length, error: failed ? { code: "unavailable" } : null }).then(resolve);
      },
    };
    return query;
  } };
  const loader = createTsLoader({
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
  assert.deepEqual(env.reads[0].range, [0, 49]);
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
