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

function actionEnvironment({ missingTeacher=false, noClass=false }={}) {
  const calls = { inserted:[], uploads:0, removed:0, filters:[] };
  const profile = { id:"student", role:"siswa", class_id:noClass?null:"class" };
  const admin = { from(table) {
    const q = {
      select(){return q;}, eq(column,value){ calls.filters.push([table,column,value]); return q; },
      async order(){return {data: missingTeacher?[]:[{id:"schedule",teacher_id:"teacher",subject_id:"subject",start_time:"09:00:00",end_time:"10:20:00"}],error:null};},
      async maybeSingle(){return {data:table==="classes"?{homeroom_teacher_id:null}:table==="subjects"?{name:"Mapel Contoh"}:{full_name:"Guru Contoh",role:"guru_bk"},error:null};},
    };return q;
  }};
  const storage={from(){return {async upload(){calls.uploads++;return {error:null};},async remove(){calls.removed++;return {error:null};}};}};
  const client={storage,from(){const q={select(){return q;},eq(){return q;},limit(){return q;},async maybeSingle(){return {data:null,error:null};},async insert(row){calls.inserted.push(row);return {error:null};}};return q;}};
  const loader=createTsLoader({
    "@/lib/auth":{getProfile:async()=>profile},
    "@/lib/supabase/admin":{createAdminClient:()=>admin},
    "@/lib/supabase/server":{createClient:async()=>client},
    "next/cache":{revalidatePath(){}},
    "next/navigation":{redirect:(url)=>{throw new Error("REDIRECT "+url);}},
  });
  return {actions:loader("src/app/(app)/izin/ajukan/actions"),calls};
}

test("pratinjau memakai nomor jam sekolah, bukan urutan jadwal", async () => {
  const {actions}=actionEnvironment();
  const preview=await actions.lookupSchedule(3);
  assert.equal(preview.status,"found");
  assert.equal(preview.period,3); // Hanya ada satu baris jadwal di fixture ini.
  assert.equal(preview.start,"09:00");
  assert.equal(preview.end,"09:40");
  assert.equal((await actions.lookupSchedule(0)).status,"choose_period");
});

function form(period="3", end=period) {
  const data=new FormData();data.set("izin_type","dispensasi");data.set("reason","Mengikuti kegiatan sekolah");
  data.set("lesson_period_start",period);data.set("lesson_period_end",end);
  data.set("evidence",new File(["contoh"],"bukti.png",{type:"image/png"}));
  return data;
}

test("pengajuan menyimpan waktu jam terpilih dan mengabaikan tanggal titipan browser", async () => {
  const {actions,calls}=actionEnvironment();
  const data=form("3","5");data.set("requested_at","2099-01-01T01:00:00Z");data.set("duration_minutes","90");
  await assert.rejects(()=>actions.createPermissionRequest({},data),/REDIRECT \/izin\?ok=1/);
  assert.equal(calls.inserted[0].requested_at,lessonRequestTime(3).requestedAt);
  assert.equal(calls.inserted[0].requested_until,lessonRangeTime(3,5).requestedUntil);
  assert.equal(calls.inserted[0].lesson_period_start,3);assert.equal(calls.inserted[0].lesson_period_end,5);
  assert.equal(Object.hasOwn(calls.inserted[0],"duration_minutes"),false);
  assert.equal(calls.inserted[0].class_id,"class");
  assert.equal(calls.uploads,1);
});

test("nomor jam salah, kelas kosong dan guru kosong tidak menyimpan pengajuan", async () => {
  for (const period of ["","0","12","1.5"]) {
    const {actions,calls}=actionEnvironment();
    assert.ok((await actions.createPermissionRequest({},form(period))).error);
    assert.equal(calls.inserted.length,0);
    assert.equal(calls.uploads,0);
  }
  for (const settings of [{noClass:true},{missingTeacher:true}]) {
    const {actions,calls}=actionEnvironment(settings);
    assert.ok((await actions.createPermissionRequest({},form())).error);
    assert.equal(calls.inserted.length,0);
    assert.equal(calls.uploads,0);
  }
  const {actions,calls}=actionEnvironment();
  assert.ok((await actions.createPermissionRequest({},form("7","3"))).error);
  assert.equal(calls.inserted.length,0);
});

test("alasan singkat dan detail opsional disimpan utuh untuk guru dan PDF", async () => {
  for (const detail of ["", "Mengikuti seleksi lomba sebagai perwakilan sekolah."]) {
    const {actions,calls}=actionEnvironment();
    const data=form("3","5");data.set("reason","Lomba LKS");data.set("reason_detail",detail);
    await assert.rejects(()=>actions.createPermissionRequest({},data),/REDIRECT/);
    assert.equal(calls.inserted[0].reason,detail?`Lomba LKS\n${detail}`:"Lomba LKS");
  }
  for (const [title,detail] of [["Judul terlalu panjang untuk form ini",""],["Hai","Detail yang panjang"],["Lomba LKS","a".repeat(1000)]]) {
    const {actions,calls}=actionEnvironment();const data=form();data.set("reason",title);data.set("reason_detail",detail);
    assert.ok((await actions.createPermissionRequest({},data)).error);assert.equal(calls.uploads,0);
  }
});

const link=({children,href,...props})=>React.createElement("a",{href,...props},children);
test("form siswa menampilkan 11 pilihan dan tidak memiliki tanggal bebas", () => {
  const loader=createTsLoader({"next/link":link,"./actions":{},"@/hooks/use-form-action":{useFormAction:()=>[{}, {}, false]}});
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
    await loader("src/app/(app)/persetujuan/page").default({searchParams:Promise.resolve({})});
    assert.ok(calls.some(c=>c[0]==="eq"&&c[1]==="status"&&c[2]==="pending"));
    if(role==="guru_bk"){
      assert.ok(calls.some(c=>c[0]==="or"&&c[1]==="current_approver_id.eq.teacher,current_layer.eq.3"));
      assert.ok(!calls.some(c=>c[0]==="eq"&&c[1]==="current_layer"));
    } else if(role!=="admin") assert.ok(calls.some(c=>c[1]==="current_approver_id"&&c[2]==="teacher"));
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
