import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTsLoader } from "./helpers/load-ts.mjs";

test("data guru tetap menampilkan email ketika akun berada setelah 1.000 akun siswa",async()=>{
  const pages=[], filters=[];
  const loader=createTsLoader({
    "next/link":({href,children,...props})=>React.createElement("a",{href,...props},children),
    "@/lib/auth":{requireRole:async role=>assert.equal(role,"admin")},
    "@/lib/supabase/server":{createClient:async()=>({from(table){
      assert.equal(table,"profiles");
      const q={select(){return q;},in(column,roles){filters.push([column,roles]);return q;},async order(){return {data:[{id:"teacher",full_name:"Guru Pengujian",role:"guru_mapel"}],error:null};}};
      return q;
    }})},
    "@/lib/supabase/admin":{createAdminClient:()=>({auth:{admin:{async listUsers({page}){
      pages.push(page);
      return {data:{users:page===1?Array.from({length:1000},(_,index)=>({id:`student-${index}`,email:`siswa${index}@example.com`})):[{id:"teacher",email:"guru@example.com"}]},error:null};
    }}}})},
    "./guru-form":{GuruForm:()=>null},"./import-form":{ImportForm:()=>null},
    "./actions":{deleteUser:async()=>{},setUserRole:async()=>{}},
    "@/components/common/delete-button":{DeleteButton:()=>null},
    "@/components/common/inline-select":{InlineSelect:()=>null},
  });
  const html=renderToStaticMarkup(await loader("src/app/(app)/admin/guru/page").default());
  assert.match(html,/Guru Pengujian/);assert.match(html,/guru@example\.com/);
  assert.doesNotMatch(html,/siswa999@example\.com/);
  assert.deepEqual(pages,[1,2]);assert.deepEqual(filters,[["role",["guru_mapel","wali_kelas","guru_bk"]]]);
});
