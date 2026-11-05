import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTsLoader } from "./helpers/load-ts.mjs";

const classes = [{ id: "first", name: "X PPLG 1" }, { id: "second", name: "X PPLG 2" }];
const schedule = {
  id: "slot",
  subject_id: "mapel",
  teacher_id: "guru",
  day_of_week: 1,
  start_time: "07:10:00",
  end_time: "08:30:00",
};

function schedulePage(total) {
  const reads = [];
  const loader = createTsLoader({
    "next/form": (props) => React.createElement("form", props),
    "next/link": (props) => React.createElement("a", props),
    "next/navigation": { redirect: (url) => { throw new Error(`Redirect ${url}`); } },
    "@/lib/auth": { requireRole: async (role) => assert.equal(role, "admin") },
    "@/lib/supabase/server": { createClient: async () => ({
      from(table) {
        const read = { table, order: [] };
        reads.push(read);
        const query = {
          select(_fields, options) { read.options = options; return query; },
          in() { return query; },
          eq(key, value) { read.filter = [key, value]; return query; },
          order(column) { read.order.push(column); return query; },
          range(from, to) { read.range = [from, to]; return query; },
          async then(resolve) {
            const result = {
              classes: { data: classes },
              subjects: { data: [{ id: "mapel", name: "Informatika" }] },
              profiles: { data: [{ id: "guru", full_name: "Guru Contoh" }] },
            }[table];
            if (result) return resolve(result);
            if (read.options.head) return resolve({ count: total });
            if (read.range[0] >= total) return resolve({ error: { code: "PGRST103" } });
            return resolve({
              count: total,
              data: [schedule, { ...schedule, id: "legacy", start_time: "09:05:00", end_time: "09:35:00" }],
            });
          },
        };
        return query;
      },
    }) },
    "./subject-form": { SubjectForm: () => null },
    "./schedule-form": { ScheduleForm: () => null },
    "./actions": {},
  });
  const page = loader("src/app/(app)/admin/jadwal/page").default;
  return { page, reads };
}

test("jadwal admin membaca satu halaman dari kelas pilihan dan menampilkan nomor serta waktu jam mapel", async () => {
  const { page, reads } = schedulePage(22);
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ kelas: "second", page: "2" }) }));
  assert.deepEqual(reads.filter((read) => read.table === "schedules"), [{
    table: "schedules",
    order: ["day_of_week", "start_time", "id"],
    options: { count: "exact" },
    filter: ["class_id", "second"],
    range: [10, 19],
  }]);
  assert.match(html, /Jadwal X PPLG 2/);
  assert.match(html, /Jam ke-1–2<\/p>.*07\.10–08\.30 WIB/);
  assert.match(html, /Jam khusus<\/p>.*09\.05–09\.35 WIB/);
  assert.match(html, /Halaman 2 dari 3/);
  assert.match(html, /kelas=second&amp;page=1#daftar-jadwal/);
  assert.match(html, /kelas=second&amp;page=3#daftar-jadwal/);
});

test("halaman yang habis setelah jadwal dihapus kembali ke halaman terakhir kelas yang sama", async () => {
  const { page, reads } = schedulePage(19);
  await assert.rejects(page({ searchParams: Promise.resolve({ kelas: "second", page: "3" }) }), /Redirect \/admin\/jadwal\?kelas=second&page=2/);
  assert.deepEqual(reads.at(-1).filter, ["class_id", "second"]);
  assert.deepEqual(reads.at(-1).options, { count: "exact", head: true });
});
