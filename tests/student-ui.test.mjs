import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTsLoader } from "./helpers/load-ts.mjs";

const load=createTsLoader();
const {schoolTerm}=load("src/components/layout/school-term");
test("tahun ajaran berganti Juli dan semester berganti Januari mengikuti WIB",()=>{
  assert.equal(schoolTerm(new Date("2026-06-30T16:59:00Z")),"2025/2026 · Genap");
  assert.equal(schoolTerm(new Date("2026-06-30T17:00:00Z")),"2026/2027 · Ganjil");
  assert.equal(schoolTerm(new Date("2026-12-31T17:00:00Z")),"2026/2027 · Genap");
});

test("surat lama dan rentang baru memakai status berdasarkan waktu WIB, tanpa timer kehadiran",()=>{
  const {studentLetterState}=load("src/features/surat/student-letters");
  const letter={permission_requests:{requested_at:"2026-11-04T02:00:00Z",requested_until:"2026-11-04T04:00:00Z"}};
  assert.equal(studentLetterState(letter,Date.parse("2026-11-04T01:00:00Z")),"scheduled");
  assert.equal(studentLetterState(letter,Date.parse("2026-11-04T03:00:00Z")),"active");
  assert.equal(studentLetterState(letter,Date.parse("2026-11-04T04:00:01Z")),"finished");
  letter.permission_requests.requested_until=null;
  assert.equal(studentLetterState(letter,Date.parse("2026-11-04T16:59:00Z")),"active");
  assert.equal(studentLetterState(letter,Date.parse("2026-11-04T17:00:00Z")),"finished");
});

test("notifikasi dikelompokkan berdasarkan hari WIB dan jenis kabar sebenarnya",()=>{
  const {notificationGroup,notificationKind}=load("src/features/notifications/presentation");
  const now=Date.parse("2026-11-03T17:15:00Z");
  assert.equal(notificationGroup("2026-11-03T17:00:00Z",now),"Hari ini");
  assert.equal(notificationGroup("2026-11-03T16:59:00Z",now),"Kemarin");
  assert.equal(notificationGroup("2026-11-01T01:00:00Z",now),"Sebelumnya");
  for(const [title,kind] of [["Izin disetujui","approved"],["Surat izin terbit","letter"],["Izin ditolak","rejected"],["Menunggu persetujuan","pending"]])assert.equal(notificationKind({title}),kind);
});

function dataEnvironment() {
  const calls=[];
  const q={select(value){calls.push(["select",value]);return q;},eq(column,value){calls.push(["eq",column,value]);return q;},order(){return Promise.resolve({data:[],error:null});},update(value){calls.push(["update",value]);return q;},then(resolve){return Promise.resolve({error:null}).then(resolve);}};
  const loader=createTsLoader({
    "./pdf-preview":{PdfPreview:()=>null},
    "@/lib/auth":{requireRole:async(...roles)=>{assert.deepEqual(roles,["siswa"]);return {id:"student-own",role:"siswa"};}},
    "@/lib/supabase/server":{createClient:async()=>({from(table){calls.push(["from",table]);return q;}})},
    "next/cache":{revalidatePath(){}},
  });
  return {loader,calls};
}

test("halaman surat hanya mengambil milik siswa dan pengajuan yang disetujui",async()=>{
  const {loader,calls}=dataEnvironment();
  await loader("src/app/(app)/surat-digital/page").default({searchParams:Promise.resolve({pengajuan:"foreign-request"})});
  assert.ok(calls.some(call=>call[0]==="eq"&&call[1]==="permission_requests.student_id"&&call[2]==="student-own"));
  assert.ok(calls.some(call=>call[0]==="eq"&&call[1]==="permission_requests.status"&&call[2]==="approved"));
});

test("query riwayat dan notifikasi selalu menyaring pemilik akun",async()=>{
  const {loader,calls}=dataEnvironment();
  await loader("src/features/izin/student-data").getStudentRequests("student-own");
  assert.ok(calls.some(call=>call[0]==="eq"&&call[1]==="student_id"&&call[2]==="student-own"));
  calls.length=0;
  await loader("src/app/(app)/notifikasi/page").default();
  assert.ok(calls.some(call=>call[0]==="eq"&&call[1]==="user_id"&&call[2]==="student-own"));
});

test("jumlah statistik tetap tepat melebihi batas daftar, dengan tiga pengajuan terbaru",async()=>{
  const queries=[];
  const loader=createTsLoader({"@/lib/supabase/server":{createClient:async()=>({from(){
    const meta={status:null,count:false,owner:null,limit:null};queries.push(meta);
    const q={select(_fields,options){meta.count=!!options?.count;return q;},eq(field,value){if(field==="status")meta.status=value;if(field==="student_id")meta.owner=value;return q;},order(){return q;},limit(value){meta.limit=value;return q;},then(resolve){return Promise.resolve({error:null,count:meta.count?({pending:1,approved:900,rejected:100}[meta.status]??1001):null,data:meta.count?null:[{id:"1"},{id:"2"},{id:"3"}]}).then(resolve);}};
    return q;
  }})}});
  const data=await loader("src/features/izin/student-data").getStudentDashboard("student-own");
  assert.deepEqual(data.statistics,{total:1001,pending:1,approved:900,rejected:100});
  assert.equal(data.requests.length,3);assert.equal(data.failed,false);
  assert.ok(queries.every(query=>query.owner==="student-own"));
  assert.equal(queries.find(query=>!query.count).limit,3);
});

test("menandai satu/semua notifikasi hanya memperbarui milik sendiri",async()=>{
  for(const id of [undefined,"10000000-0000-4000-8000-000000000001"]) {
    const {loader,calls}=dataEnvironment();const result=await loader("src/app/(app)/notifikasi/actions").readNotifications(id);
    assert.deepEqual(result,{});
    assert.ok(calls.some(call=>call[0]==="eq"&&call[1]==="user_id"&&call[2]==="student-own"));
    assert.equal(calls.some(call=>call[0]==="eq"&&call[1]==="id"),!!id);
  }
  const {loader,calls}=dataEnvironment();assert.ok((await loader("src/app/(app)/notifikasi/actions").readNotifications("bad-id")).error);
  assert.equal(calls.length,0);
});

test("beranda menampilkan statistik akun, tiga pengajuan terakhir, dan judul tanpa membuang detail",()=>{
  const link=({children,href,...props})=>React.createElement("a",{href,...props},children);
  const loader=createTsLoader({"next/link":link});
  const Page=loader("src/app/(app)/dashboard/student-dashboard").StudentDashboard;
  const requests=["pending","approved","rejected","cancelled"].map((status,i)=>({id:String(i),reason:`Kegiatan ${i}\nDetail panjang`,izin_type:"dispensasi",status,created_at:"2026-11-04T00:00:00Z"}));
  const html=renderToStaticMarkup(React.createElement(Page,{profile:{full_name:"Siswa Contoh",nis:"CONTOH"},requests,statistics:{total:4,pending:1,approved:1,rejected:1},failed:false}));
  assert.match(html,/Siswa Contoh/);assert.match(html,/Total Pengajuan/);assert.match(html,/>4<\/p>/);
  for(const id of [0,1,2])assert.match(html,new RegExp(`href="/izin/${id}"`));
  assert.doesNotMatch(html,/href="\/izin\/3"/);
  assert.doesNotMatch(html,/Detail panjang/);
});
