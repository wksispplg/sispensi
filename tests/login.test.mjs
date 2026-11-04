import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTsLoader } from "./helpers/load-ts.mjs";

const studentId="10000000-0000-4000-8000-000000000001";
const accountEmail="siswa-contoh@example.com";
const password="PasswordContoh!26";

function loginEnvironment(options={}) {
  const queries=[];const userLookups=[];const signIns=[];let adminClients=0;
  const admin={
    from(table){const query={table,filters:[]};queries.push(query);return {
      select(fields){query.fields=fields;return this;},eq(field,value){query.filters.push([field,value]);return this;},
      async maybeSingle(){return {data:options.missing?null:{id:studentId},error:options.lookupError??null};},
    };},
    auth:{admin:{async getUserById(id){userLookups.push(id);return {data:{user:options.noEmail?{id}:{id,email:accountEmail}},error:options.userError??null};}}},
  };
  const client={auth:{async signInWithPassword(credentials){signIns.push(credentials);if(options.throwAuth)throw new Error("Private network error");return {error:options.wrongPassword?{message:"Internal auth detail"}:null};}}};
  const loader=createTsLoader({
    "@/lib/supabase/admin":{createAdminClient:()=>{adminClients++;if(options.missingConfig)throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");return admin;}},
    "@/lib/supabase/server":{createClient:async()=>client},
    "next/navigation":{redirect:path=>{throw Object.assign(new Error("redirect"),{destination:path});}},
  });
  return {login:loader("src/app/(auth)/login/actions").login,queries,userLookups,signIns,adminClients:()=>adminClients};
}

function form(identifier="001234567",next="",secret=password){const data=new FormData();data.set("identifier",identifier);data.set("password",secret);data.set("next",next);return data;}
async function destination(env,data){await assert.rejects(env.login({},data),error=>error.destination!==undefined&&(assert.equal(error.message,"redirect"),true));}

test("login NIS mempertahankan angka nol awal, mencari hanya siswa, lalu memverifikasi password lewat Auth",async()=>{
  const env=loginEnvironment();await destination(env,form(" 001234567 "));
  assert.deepEqual(env.queries,[{table:"profiles",fields:"id",filters:[["nis","001234567"],["role","siswa"]]}]);
  assert.deepEqual(env.userLookups,[studentId]);
  assert.deepEqual(env.signIns,[{email:accountEmail,password}]);
});

test("login email guru/admin dan email siswa tetap memakai autentikasi biasa tanpa pencarian NIS",async()=>{
  const env=loginEnvironment({missingConfig:true});await destination(env,form(" GURU@EXAMPLE.COM "));
  assert.deepEqual(env.signIns,[{email:"guru@example.com",password}]);assert.equal(env.adminClients(),0);
});

test("NIS tidak terdaftar dan password salah memakai pesan sama tanpa membocorkan email akun",async()=>{
  const unknown=loginEnvironment({missing:true});const wrong=loginEnvironment({wrongPassword:true});
  const first=await unknown.login({},form());const second=await wrong.login({},form());
  assert.deepEqual(first,{error:"NIS/email atau password salah.",identifier:"001234567"});assert.deepEqual(second,first);
  assert.equal(unknown.signIns.length,0);
  assert.doesNotMatch(JSON.stringify(second),new RegExp(accountEmail));assert.doesNotMatch(JSON.stringify(second),/Internal auth detail|PasswordContoh/);
});

test("isian tidak valid ditolak sebelum layanan akun dibaca",async()=>{
  const inputs=[form(""),form("not an nis"),form("invalid@email"),form("1".repeat(255)),form("123456","","")];
  const fileForm=form();fileForm.set("identifier",new File(["123456"],"identifier.txt"));inputs.push(fileForm);
  for(const input of inputs){const env=loginEnvironment();assert.ok((await env.login({},input)).error);assert.equal(env.adminClients(),0);assert.equal(env.signIns.length,0);}
});

test("gangguan pencarian NIS atau Auth tidak membocorkan detail layanan",async()=>{
  for(const options of [{lookupError:{message:"private database detail"}},{userError:{message:"private auth user"}},{missingConfig:true},{throwAuth:true}]){
    const env=loginEnvironment(options);const result=await env.login({},form());
    assert.deepEqual(result,{error:"Login belum dapat diproses. Silakan coba lagi.",identifier:"001234567"});
    assert.doesNotMatch(JSON.stringify(result),/service_role|SUPABASE|private|PasswordContoh|example\.com/i);
  }
  const noEmail=loginEnvironment({noEmail:true});assert.ok((await noEmail.login({},form())).error);assert.equal(noEmail.signIns.length,0);
});

test("login tidak dapat mengarahkan pengguna ke URL luar atau kembali ke halaman autentikasi",async()=>{
  for(const next of ["https://example.com","//example.com","/\\example.com","/login","/auth/signout",""]){
    const env=loginEnvironment();await assert.rejects(env.login({},form("siswa@example.com",next)),error=>error.destination==="/dashboard");
  }
  const env=loginEnvironment();await assert.rejects(env.login({},form("siswa@example.com","/izin?status=pending")),error=>error.destination==="/izin?status=pending");
});

test("dashboard mengambil nama dan NIS dari profil sesi siswa, bukan nama dari contoh desain",async()=>{
  for(const [id,name,nis] of [["akun-1","Aditya Pratama","001234567"],["akun-2","Nabila Putri Ramadhani","001234568"]]){
    const owners=[];
    const loader=createTsLoader({
      "@/lib/auth":{getProfile:async()=>({id,role:"siswa",full_name:name,nis})},
      "@/features/izin/student-data":{getStudentDashboard:async owner=>{owners.push(owner);return {requests:[],statistics:{total:0,pending:0,approved:0,rejected:0},failed:false};}},
      "@/features/approvals/data":{getStaffDashboard:()=>{throw new Error("Siswa tidak membaca data staff");}},
      "./staff-dashboard":{StaffDashboard:()=>null},
      "next/link":({children,href,...props})=>React.createElement("a",{href,...props},children),
    });
    const element=await loader("src/app/(app)/dashboard/page").default();
    const html=renderToStaticMarkup(element);
    assert.deepEqual(owners,[id]);assert.match(html,new RegExp(name));assert.match(html,new RegExp(`Selamat datang, ${nis}`));
    assert.doesNotMatch(html,/Khansa Veasna|541241109/);
  }
});
