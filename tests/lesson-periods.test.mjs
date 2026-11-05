import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTsLoader } from "./helpers/load-ts.mjs";

const load = createTsLoader();
const { LESSON_PERIODS } = load("src/lib/constants");
const { lessonRequestTime, lessonPeriodLabel, lessonRangeTime, lessonRangeLabel } = load("src/features/izin/lesson-periods");

test("pilihan jam 1-11 mengikuti gambar, tanpa slot pembukaan/istirahat", () => {
  assert.deepEqual(LESSON_PERIODS.map(p => [p.number, p.start, p.end]), [
    [1,"07:10","07:50"],[2,"07:50","08:30"],[3,"09:00","09:40"],[4,"09:40","10:20"],
    [5,"10:20","11:00"],[6,"11:00","11:40"],[7,"11:40","12:20"],[8,"13:20","14:00"],
    [9,"14:00","14:40"],[10,"14:40","15:20"],[11,"15:20","16:00"],
  ]);
  assert.equal(lessonPeriodLabel(8), "Jam ke-8 · 13.20–14.00 WIB");
  for (const invalid of [0,12,1.5,NaN]) assert.throws(() => lessonRequestTime(invalid));
});

test("tanggal otomatis WIB tetap benar saat hari/tahun UTC berbeda", () => {
  assert.deepEqual(lessonRequestTime(3, new Date("2026-11-02T18:30:00Z")), {
    period: LESSON_PERIODS[2], requestedAt:"2026-11-03T02:00:00.000Z", day:2, time:"09:00:00", date:"2026-11-03",
  });
  assert.equal(lessonRequestTime(11, new Date("2026-12-31T18:00:00Z")).requestedAt, "2027-01-01T08:20:00.000Z");
});

const requestId = "70000000-0000-4000-8000-000000000001";
const evidencePath = `student/${requestId}.png`;

function actionEnvironment({ missingTeacher=false, noClass=false, role="siswa", insertError=null, duplicate=false, homeroom=null, stored={ size:1024, contentType:"image/png" } }={}) {
  const calls = { inserted:[], evidenceChecks:[], filters:[], scheduleReads:0 };
  const profile = { id:"student", role, class_id:noClass?null:"class" };
  const admin = { from(table) {
    assert.equal(table, "classes");
    const query = {
      select() { return query; },
      eq(column, value) { calls.filters.push([table, column, value]); return query; },
      lte(column, value) { calls.filters.push([table, column, value]); return query; },
      gt(column, value) { calls.filters.push([table, column, value]); return query; },
      order() { return query; },
      async maybeSingle() {
        calls.scheduleReads++;
        return { data: { homeroom, schedules: missingTeacher ? [] : [{
          teacher: { full_name: "Guru Contoh", role: "guru_bk" },
          subject: { name: "Mapel Contoh" },
        }] }, error: null };
      },
    };
    return query;
  } };
  const storage = { from: () => ({ async info(path) {
    calls.evidenceChecks.push(path);
    return { data: stored, error: null };
  } }) };
  const client = { storage, from() {
    const filters = new Map();
    const query = {
      select() { return query; },
      eq(column, value) {
        calls.filters.push(["request", column, value]);
        filters.set(column, value);
        return query;
      },
      limit() { return query; },
      async maybeSingle() {
        if (filters.has("id")) {
          const saved = calls.inserted.find(row => row.id === filters.get("id") && row.student_id === filters.get("student_id") && row.evidence_url === filters.get("evidence_url"));
          return { data: saved ?? null, error: null };
        }
        throw new Error("Pengajuan hanya boleh membaca kembali ID yang sudah dikirim.");
      },
      async insert(row) {
        if (insertError) return { error: insertError };
        if (missingTeacher) return { error: { code: "P0001", message: "Guru pada waktu izin dan wali kelas belum tersedia." } };
        if (duplicate || calls.inserted.some(item => item.id === row.id)) return { error: { code: "23505" } };
        calls.inserted.push(row);
        return { error: null };
      },
    };
    return query;
  } };
  const loader=createTsLoader({
    "@/lib/auth":{getProfile:async()=>profile},
    "@/lib/supabase/admin":{createAdminClient:()=>admin},
    "@/lib/supabase/server":{createClient:async()=>client},
    "next/cache":{revalidatePath(){}},
  });
  return {actions:loader("src/app/(app)/izin/ajukan/actions"),calls};
}

test("pratinjau memakai nomor jam sekolah, bukan urutan jadwal", async () => {
  const {actions,calls}=actionEnvironment();
  const preview=await actions.lookupSchedule(3);
  assert.equal(preview.status,"found");
  assert.equal(preview.period,3); // Hanya ada satu baris jadwal di fixture ini.
  assert.equal(preview.start,"09:00");
  assert.equal(preview.end,"09:40");
  assert.equal((await actions.lookupSchedule(0)).status,"choose_period");
  assert.equal(calls.scheduleReads, 1);
  assert.ok(calls.filters.some(([,column,value])=>column==="schedules.start_time"&&value==="09:00:00"));
  assert.ok(calls.filters.some(([,column,value])=>column==="schedules.end_time"&&value==="09:00:00"));
  const fallback=actionEnvironment({missingTeacher:true,homeroom:{full_name:"Wali Contoh",role:"wali_kelas"}});
  assert.equal((await fallback.actions.lookupSchedule(3)).approver,"Wali Contoh");
  assert.equal(fallback.calls.scheduleReads,1);
});

function form(period="3", end=period) {
  const data=new FormData();data.set("izin_type","dispensasi");data.set("reason","Mengikuti kegiatan sekolah");
  data.set("lesson_period_start",period);data.set("lesson_period_end",end);
  data.set("evidence_path", evidencePath);
  return data;
}

test("pengajuan menyimpan waktu jam terpilih dan mengabaikan tanggal titipan browser", async () => {
  const {actions,calls}=actionEnvironment();
  const data=form("3","5");data.set("requested_at","2099-01-01T01:00:00Z");data.set("duration_minutes","90");
  assert.deepEqual(await actions.createPermissionRequest({},data), { ok: true });
  assert.equal(calls.inserted[0].requested_at,lessonRequestTime(3).requestedAt);
  assert.equal(calls.inserted[0].requested_until,lessonRangeTime(3,5).requestedUntil);
  assert.equal(calls.inserted[0].lesson_period_start,3);assert.equal(calls.inserted[0].lesson_period_end,5);
  assert.equal(Object.hasOwn(calls.inserted[0],"duration_minutes"),false);
  assert.equal(calls.inserted[0].class_id,"class");
  assert.deepEqual(calls.evidenceChecks, [evidencePath]);
  assert.equal(calls.scheduleReads,0);
  assert.deepEqual(calls.filters,[]);
});

test("nomor jam salah, kelas kosong dan guru kosong tidak menyimpan pengajuan", async () => {
  for (const period of ["","0","12","1.5"]) {
    const {actions,calls}=actionEnvironment();
    assert.ok((await actions.createPermissionRequest({},form(period))).error);
    assert.equal(calls.inserted.length,0);
    assert.equal(calls.evidenceChecks.length,0);
  }
  for (const settings of [{noClass:true},{missingTeacher:true}]) {
    const {actions,calls}=actionEnvironment(settings);
    const result = await actions.createPermissionRequest({},form());
    assert.match(result.error, settings.missingTeacher ? /wali kelas belum tersedia/ : /belum terdaftar di kelas/);
    assert.equal(calls.inserted.length,0);
    assert.equal(calls.evidenceChecks.length, settings.missingTeacher ? 1 : 0);
  }
  const {actions,calls}=actionEnvironment();
  assert.ok((await actions.createPermissionRequest({},form("7","3"))).error);
  assert.equal(calls.inserted.length,0);
});

test("alasan singkat dan detail opsional disimpan utuh untuk guru dan PDF", async () => {
  for (const detail of ["", "Mengikuti seleksi lomba sebagai perwakilan sekolah."]) {
    const {actions,calls}=actionEnvironment();
    const data=form("3","5");data.set("reason","Lomba LKS");data.set("reason_detail",detail);
    assert.deepEqual(await actions.createPermissionRequest({},data), { ok: true });
    assert.equal(calls.inserted[0].reason,detail?`Lomba LKS\n${detail}`:"Lomba LKS");
  }
  for (const [title,detail] of [["Judul terlalu panjang untuk form ini",""],["Hai","Detail yang panjang"],["Lomba LKS","a".repeat(1000)]]) {
    const {actions,calls}=actionEnvironment();const data=form();data.set("reason",title);data.set("reason_detail",detail);
    assert.ok((await actions.createPermissionRequest({},data)).error);assert.equal(calls.evidenceChecks.length,0);
  }
});

const link=({children,href,...props})=>React.createElement("a",{href,...props},children);
const router = { useRouter: () => ({ push() {} }) };
test("form siswa menampilkan 11 pilihan dan tidak memiliki tanggal bebas", () => {
  const loader=createTsLoader({"next/link":link,"next/navigation":router,"./actions":{},"@/lib/supabase/client":{},"@/hooks/use-form-action":{useFormAction:()=>[{}, {}, false]}});
  const Page=loader("src/app/(app)/izin/ajukan/page").default;
  const html=renderToStaticMarkup(React.createElement(Page));
  assert.doesNotMatch(html,/datetime-local/);
  assert.match(html,/name="lesson_period_start"/);
  assert.match(html,/name="lesson_period_end"/);
  assert.doesNotMatch(html,/duration_minutes|Mulai Dispen|Perkiraan durasi/);
  assert.match(html,/Berlaku untuk hari ini \(WIB\)/);
  const select=html.match(/<select[^>]*name="lesson_period_start"[\s\S]*?<\/select>/)[0];
  assert.equal((select.match(/<option /g)||[]).length,12); // Placeholder + 11 jam.
  assert.match(select,/15.20–16.00 WIB/);
});

test("form izin masuk mempertahankan alasan dan bukti dengan satu pilihan dari 11 jam mapel", async () => {
  const loader=createTsLoader({"next/link":link,"next/navigation":router,"./actions":{},"@/lib/supabase/client":{},"@/hooks/use-form-action":{useFormAction:()=>[{}, {}, false]},"@/lib/auth":{requireRole:async role=>assert.equal(role,"siswa")}});
  const Page=loader("src/app/(app)/izin/masuk-kelas/page").default;
  const html=renderToStaticMarkup(await Page());
  assert.match(html,/name="izin_type" value="masuk_kelas"/);
  assert.match(html.match(/<input(?=[^>]*name="reason")[^>]*>/)[0],/required/);
  assert.match(html,/name="reason_detail"/);
  assert.match(html.match(/<input(?=[^>]*name="evidence")[^>]*>/)[0],/required/);
  assert.match(html,/Pilih jam mapel masuk/);
  assert.doesNotMatch(html,/lesson_period_end|datetime-local|Pilih jam mapel selesai/);
  const select=html.match(/<select[^>]*name="lesson_period_start"[\s\S]*?<\/select>/)[0];
  assert.equal((select.match(/<option /g)||[]).length,12);
  assert.equal((html.match(/<select/g)||[]).length,1);
});

test("izin masuk menyimpan satu jam mapel dan mengabaikan jam akhir titipan browser", async()=>{
  for(const end of [null,"11"]) {
    const {actions,calls}=actionEnvironment();
    const data=form("3");data.set("izin_type","masuk_kelas");
    if(end===null)data.delete("lesson_period_end");else data.set("lesson_period_end",end);
    assert.deepEqual(await actions.createPermissionRequest({},data), { ok: true });
    assert.equal(calls.inserted[0].izin_type,"masuk_kelas");
    assert.equal(calls.inserted[0].lesson_period_start,3);
    assert.equal(calls.inserted[0].lesson_period_end,3);
    assert.equal(calls.inserted[0].requested_at,lessonRangeTime(3,3).requestedAt);
    assert.equal(calls.inserted[0].requested_until,lessonRangeTime(3,3).requestedUntil);
    assert.equal(calls.scheduleReads,0);
  }
});

test("izin masuk tetap menolak guru, bukti kosong, jam salah dan pengajuan ganda", async()=>{
  for(const setting of [{role:"guru_mapel"},{duplicate:true}]){
    const {actions,calls}=actionEnvironment(setting);const data=form();data.set("izin_type","masuk_kelas");
    assert.ok((await actions.createPermissionRequest({},data)).error);assert.equal(calls.evidenceChecks.length,setting.duplicate?1:0);assert.equal(calls.inserted.length,0);
  }
  for(const period of ["0","12","1.5",""]){
    const {actions,calls}=actionEnvironment();const data=form(period);data.set("izin_type","masuk_kelas");
    assert.ok((await actions.createPermissionRequest({},data)).error);assert.equal(calls.evidenceChecks.length,0);
  }
  const {actions,calls}=actionEnvironment();const data=form();data.set("izin_type","masuk_kelas");data.delete("evidence_path");
  assert.match((await actions.createPermissionRequest({},data)).error,/Bukti pendukung wajib/);assert.equal(calls.inserted.length,0);
});

test("database tanpa jenis izin masuk memberi pesan aktivasi sebelum pengajuan disimpan",async()=>{
  const {actions,calls}=actionEnvironment({insertError:{code:"22P02"}});const data=form();data.set("izin_type","masuk_kelas");
  assert.match((await actions.createPermissionRequest({},data)).error,/belum diaktifkan di database/);
  assert.equal(calls.evidenceChecks.length,1);assert.equal(calls.inserted.length,0);
});

test("bukti 5 MB diunggah sekali, percobaan ulang mengirim formulir kecil dan membuka riwayat", async () => {
  const file = new File([new Uint8Array(5 * 1024 * 1024)], "foto-hp.jpg", { type: "image/jpeg" });
  let submit;
  let uploadedPath;
  let uploadCount = 0;
  let submitCount = 0;
  const navigations = [];
  const loader = createTsLoader({
    "next/link": link,
    "next/navigation": { useRouter: () => ({ push: url => navigations.push(url) }) },
    "@/hooks/use-form-action": { useFormAction(action) { submit = action; return [{}, {}, false]; } },
    "@/lib/supabase/client": { createClient: () => ({
      auth: { async getSession() { return { data: { session: { user: { id: "student" } } } }; } },
      storage: { from: () => ({ async upload(path, uploaded) {
        assert.equal(uploaded, file);
        uploadedPath = path;
        uploadCount++;
        return { error: null };
      } }) },
    }) },
    "./actions": { async createPermissionRequest(_state, data) {
      assert.equal(data.get("evidence_path"), uploadedPath);
      assert.equal(data.has("evidence"), false);
      const request = new Request("http://localhost/izin/ajukan", { method: "POST", body: data });
      assert.ok((await request.arrayBuffer()).byteLength < 1024);
      if (++submitCount === 1) throw new TypeError("Koneksi putus");
      return { ok: true };
    } },
  });
  const PermissionRequestForm = loader("src/app/(app)/izin/ajukan/request-form").default;
  renderToStaticMarkup(React.createElement(PermissionRequestForm));
  const submitEvidence = () => {
    const data = form();
    data.set("evidence", file);
    return submit({}, data);
  };
  assert.match((await submitEvidence()).error, /Periksa koneksi/);
  assert.deepEqual(navigations, []);
  assert.deepEqual(await submitEvidence(), { ok: true });
  assert.deepEqual(navigations, ["/izin?ok=1"]);
  assert.equal(uploadCount, 1);
  assert.match(uploadedPath, /^student\/[0-9a-f-]{36}\.jpg$/);
});

test("pengajuan memeriksa kepemilikan dan metadata bukti, serta aman dikirim ulang", async () => {
  const { actions, calls } = actionEnvironment({ stored: { size: 5 * 1024 * 1024, contentType: "image/png" } });
  const otherStudent = form();
  otherStudent.set("evidence_path", `other-student/${requestId}.png`);
  assert.match((await actions.createPermissionRequest({}, otherStudent)).error, /dari akunmu/);
  assert.deepEqual(calls.evidenceChecks, []);
  assert.deepEqual(await actions.createPermissionRequest({}, form()), { ok: true });
  assert.deepEqual(await actions.createPermissionRequest({}, form()), { ok: true });
  assert.equal(calls.inserted.length, 1);
  assert.equal(calls.inserted[0].id, requestId);
  assert.equal(calls.inserted[0].evidence_url, evidencePath);
  assert.deepEqual(calls.evidenceChecks, [evidencePath,evidencePath]);

  for (const stored of [null, { size: 5 * 1024 * 1024 + 1, contentType: "image/png" }, { size: 1024, contentType: "text/html" }]) {
    const invalid = actionEnvironment({ stored });
    assert.ok((await invalid.actions.createPermissionRequest({}, form())).error);
    assert.equal(invalid.calls.inserted.length, 0);
  }
});

test("menu izin masuk hanya tersedia untuk siswa dan masuk ke jalur formulir tersendiri",()=>{
  const {navItemsForRole,activeNavHref}=load("src/lib/navigation");
  assert.equal(activeNavHref("/izin/masuk-kelas",navItemsForRole("siswa")),"/izin/masuk-kelas");
  for(const role of ["guru_mapel","wali_kelas","guru_bk","admin"])assert.ok(!navItemsForRole(role).some(item=>item.href==="/izin/masuk-kelas"));
});

test("rentang menghitung jam akhir tanpa memberi nomor pada waktu istirahat",()=>{
  const range=lessonRangeTime(2,3,new Date("2026-11-03T01:00:00Z"));
  assert.equal(range.requestedAt,"2026-11-03T00:50:00.000Z");
  assert.equal(range.requestedUntil,"2026-11-03T02:40:00.000Z");
  assert.equal(lessonRangeLabel(2,3),"Jam ke-2 s.d. ke-3 (07.50–09.40 WIB)");
  assert.throws(()=>lessonRangeTime(8,7));
  assert.equal(lessonRangeLabel(null,null),null);
  const nav=load("src/lib/navigation");
  for(const role of ["siswa","guru_mapel","wali_kelas","guru_bk","admin"]) assert.ok(nav.navItemsForRole(role).every(item=>item.href!=="/pemantauan"));
});

test("Guru BK menerima tugas Lapis 1/2 selain antrian Lapis 3; guru lain tetap dibatasi", async () => {
  for (const role of ["guru_bk","guru_mapel","wali_kelas","admin"]) {
    const calls=[];
    const loader=createTsLoader({
      "next/link":link,"next/navigation":{redirect(){throw Error("forbidden");}},
      "@/lib/auth":{getProfile:async()=>({id:"teacher",role})},
      "@/lib/supabase/server":{createClient:async()=>({from(table){
        const q={select(){return q;},eq(c,v){calls.push(["eq",c,v]);return q;},or(v){calls.push(["or",v]);return q;},
          async order(){return {data:[],error:null};},async in(){return {data:[],error:null};}};
        calls.push(["table",table]);return q;
      }})},
    });
    if(role==="admin") {
      await assert.rejects(loader("src/app/(app)/persetujuan/page").default({searchParams:Promise.resolve({})}),/forbidden/);
      assert.equal(calls.length,0);
      continue;
    }
    await loader("src/app/(app)/persetujuan/page").default({searchParams:Promise.resolve({})});
    assert.ok(calls.some(c=>c[0]==="eq"&&c[1]==="status"&&c[2]==="pending"));
    if(role==="guru_bk"){
      assert.ok(calls.some(c=>c[0]==="or"&&c[1]==="current_approver_id.eq.teacher,current_layer.eq.3"));
      assert.ok(!calls.some(c=>c[0]==="eq"&&c[1]==="current_layer"));
    } else assert.ok(calls.some(c=>c[1]==="current_approver_id"&&c[2]==="teacher"));
  }
});

test("jadwal admin memakai awal/akhir jam sekolah, tanpa menerima waktu bebas", async () => {
  const rows=[];
  const loader=createTsLoader({
    "@/lib/auth":{getProfile:async()=>({role:"admin"})},
    "@/lib/supabase/server":{createClient:async()=>({from:()=>({insert:async(row)=>{rows.push(row);return {error:null};}})})},
    "next/cache":{revalidatePath(){}},
  });
  const {createSchedule}=loader("src/app/(app)/admin/jadwal/actions");
  const data=new FormData();
  for(const key of ["class_id","subject_id","teacher_id"]) data.set(key,"12345678-1234-4234-8234-123456789abc");
  data.set("day_of_week","2");data.set("start_period","3");data.set("end_period","7");
  data.set("start_time","00:00");
  assert.equal((await createSchedule({},data)).ok,true);
  assert.equal(rows[0].start_time,"09:00");assert.equal(rows[0].end_time,"12:20");
  data.set("end_period","2");
  assert.ok((await createSchedule({},data)).error);
  assert.equal(rows.length,1);
});
