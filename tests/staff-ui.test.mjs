import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTsLoader } from "./helpers/load-ts.mjs";

const id="10000000-0000-4000-8000-000000000001";
const requestId="20000000-0000-4000-8000-000000000001";
const row={id:requestId,student_id:"student",class_id:"class",reason:"Lomba LKS\nMewakili sekolah.",izin_type:"dispensasi",status:"approved",current_layer:1,created_at:"2026-11-04T01:00:00Z",requested_at:"2026-11-04T02:00:00Z",requested_until:"2026-11-04T04:00:00Z",lesson_period_start:3,lesson_period_end:5,current_deadline:null,evidence_url:"private/storage-path",decided_at:"2026-11-04T01:15:00Z"};

function environment(role="guru_mapel", rpcError=null) {
  const calls=[];const invalidated=[];const rpcs=[];
  const profile={id,role,full_name:"Guru Contoh"};
  const client={from(table){
    const meta={table,fields:null,count:false,filters:[],limit:null};calls.push(meta);
    const q={select(fields,options){meta.fields=fields;meta.count=!!options?.count;return q;},eq(field,value){meta.filters.push([field,value]);return q;},or(value){meta.or=value;return q;},gte(field,value){meta.filters.push(["gte",field,value]);return q;},order(){return q;},limit(value){meta.limit=value;return q;},in(field,value){meta.filters.push(["in",field,value]);return q;},update(value){meta.update=value;return q;},then(resolve){return Promise.resolve({data:meta.count?null:table==="permission_requests"?[row]:table==="profiles"?[{id:"student",full_name:"Siswa Contoh"}]:table==="classes"?[{id:"class",name:"XI RPL 1"}]:[],count:meta.count?7:null,error:null}).then(resolve);}};
    return q;
  },async rpc(name,args){rpcs.push({name,args});return {error:rpcError};}};
  const loader=createTsLoader({
    "@/lib/supabase/server":{createClient:async()=>client},
    "@/lib/auth":{getProfile:async()=>profile,requireProfile:async()=>profile},
    "next/cache":{revalidatePath:path=>invalidated.push(path)},
  });
  return {loader,calls,profile,rpcs,invalidated};
}

test("daftar dan angka persetujuan mengikuti penugasan guru, BK Lapis 1/2/3, dan admin",async()=>{
  for(const role of ["guru_mapel","wali_kelas","guru_bk","admin"]){
    const {loader,calls,profile}=environment(role);
    const data=await loader("src/features/approvals/data").getStaffDashboard(profile);
    const pending=calls.filter(call=>call.table==="permission_requests"&&call.filters.some(([key,value])=>key==="status"&&value==="pending")&&!call.filters.some(([key])=>key==="current_layer"));
    assert.equal(pending.length,2); // Daftar dan hitungan memakai cakupan yang sama.
    for(const query of pending){
      if(role==="guru_bk")assert.equal(query.or,`current_approver_id.eq.${id},current_layer.eq.3`);
      else if(role!=="admin")assert.ok(query.filters.some(([key,value])=>key==="current_approver_id"&&value===id));
      else assert.ok(!query.filters.some(([key])=>key==="current_approver_id"));
    }
    assert.equal(data.pendingCount,7);
    assert.equal(data.pending[0].studentName,"Siswa Contoh");
    assert.equal(data.pending[0].className,"XI RPL 1");
    assert.equal(data.pending[0].hasEvidence,true);
    assert.equal(Object.hasOwn(data.pending[0],"evidence_url"),false);
    assert.equal(Object.hasOwn(data.pending[0],"student_id"),false);
    if(role==="admin")assert.deepEqual(data.school,{students:7,teachers:7,classes:7});
    if(role==="guru_bk")assert.equal(data.layer3Count,7);
  }
});

test("riwayat guru, BK dan admin hanya memuat keputusan akun sendiri",async()=>{
  for(const role of ["guru_mapel","wali_kelas","guru_bk","admin"]){
    const {loader,calls,profile}=environment(role);
    await loader("src/features/approvals/data").getDecisionHistory(profile);
    for(const query of calls.filter(call=>call.table==="permission_requests"))assert.ok(query.filters.some(([key,value])=>key==="decided_by"&&value===id));
  }
});

function form(action="approved",note="",request=requestId){const data=new FormData();data.set("id",request);data.set("_action",action);data.set("note",note);return data;}
test("siswa, ID tidak valid, aksi tidak valid dan penolakan tanpa alasan tidak memanggil keputusan",async()=>{
  const student=environment("siswa");assert.ok((await student.loader("src/features/approvals/actions").saveDecision({},form())).error);assert.equal(student.rpcs.length,0);
  for(const data of [form("invalid"),form("approved","","bad-id"),form("rejected","  "),form("approved","a".repeat(1001))]){
    const env=environment();assert.ok((await env.loader("src/features/approvals/actions").saveDecision({},data)).error);assert.equal(env.rpcs.length,0);
  }
});

test("keputusan cepat memakai RPC berotorisasi dan menyegarkan daftar, statistik, riwayat dan surat",async()=>{
  for(const role of ["guru_mapel","wali_kelas","guru_bk","admin"]){
    const env=environment(role);const result=await env.loader("src/features/approvals/actions").saveDecision({},form("rejected","Bukti belum jelas"));
    assert.deepEqual(result,{ok:true});assert.deepEqual(env.rpcs,[{name:"decide_request",args:{p_request:requestId,p_action:"rejected",p_note:"Bukti belum jelas"}}]);
    const read=env.calls.find(call=>call.table==="notifications"&&call.update);assert.ok(read.filters.some(([key,value])=>key==="user_id"&&value===id));assert.ok(read.filters.some(([key,value])=>key==="request_id"&&value===requestId));
    for(const path of ["/dashboard","/persetujuan","/riwayat-keputusan","/izin","/notifikasi","/surat-digital"])assert.ok(env.invalidated.includes(path));
  }
  const stale=environment("guru_mapel",{message:"Pengajuan sudah diputuskan"});assert.deepEqual(await stale.loader("src/features/approvals/actions").saveDecision({},form()),{error:"Pengajuan sudah diputuskan"});assert.equal(stale.invalidated.length,0);
});

test("notifikasi semua peran hanya dapat ditandai pada akun sendiri",async()=>{
  for(const role of ["siswa","guru_mapel","wali_kelas","guru_bk","admin"]){
    const env=environment(role);await env.loader("src/app/(app)/notifikasi/actions").readNotifications(id);
    const query=env.calls.find(call=>call.update);assert.ok(query.filters.some(([key,value])=>key==="user_id"&&value===id));
    assert.ok(query.filters.some(([key,value])=>key==="id"&&value===id));
  }
});

test("menu guru, BK dan admin tersedia tanpa fitur pemantauan yang sudah dihapus",()=>{
  const {navItemsForRole}=createTsLoader()("src/lib/navigation");
  for(const role of ["guru_mapel","wali_kelas","guru_bk","admin"]){
    const items=navItemsForRole(role);assert.ok(items.some(item=>item.href==="/notifikasi"));assert.ok(items.some(item=>item.href==="/scan"));assert.ok(items.every(item=>item.href!=="/pemantauan"));
  }
});

test("beranda guru tidak memuat contoh hitungan atau istilah pemantauan; menu admin tetap memakai data sekolah",()=>{
  const Link=({children,href,...props})=>React.createElement("a",{href,...props},children);
  const loader=createTsLoader({"next/link":Link,"./actions":{},"next/navigation":{},"@/hooks/use-form-action":{useFormAction:()=>[{}, {}, false]}});
  const Dashboard=loader("src/app/(app)/dashboard/staff-dashboard").StaffDashboard;
  const data={pending:[],recentDecisions:[],statistics:{total:23,approved:20,rejected:3,approvedToday:2},pendingCount:6,school:null,layer3Count:0,failed:false,now:Date.parse("2026-11-04T03:00:00Z")};
  const html=renderToStaticMarkup(React.createElement(Dashboard,{profile:{role:"guru_mapel",full_name:"Guru Contoh"},data}));
  assert.match(html,/Guru Contoh/);assert.match(html,/>23<\/p>/);assert.match(html,/Tinjau Pengajuan/);assert.doesNotMatch(html,/Sedang Dispen|Belum kembali|Pemantauan/);
  const admin=renderToStaticMarkup(React.createElement(Dashboard,{profile:{role:"admin",full_name:"Admin Contoh"},data:{...data,school:{students:100,teachers:10,classes:4}}}));
  assert.match(admin,/Total Siswa/);assert.match(admin,/Kelola Data Sekolah/);assert.match(admin,/href="\/admin\/siswa"/);
});
