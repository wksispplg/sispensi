import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { createTsLoader } from "./helpers/load-ts.mjs";

test("rekap dan ekspor memakai rentang jam tanpa statistik pemantauan",async()=>{
  const record={id:"request",student_id:"student",class_id:"class",izin_type:"dispensasi",status:"approved",current_layer:1,
    created_at:"2026-11-03T01:30:00Z",requested_at:"2026-11-03T02:00:00Z",requested_until:"2026-11-03T04:00:00Z",
    lesson_period_start:3,lesson_period_end:5,reason:"Kegiatan sekolah",decided_by:"teacher",
    duration_minutes:30,dispen_started_at:"2026-11-03T02:00:00Z",returned_at:null,dispen_deadline:"2026-11-03T02:30:00Z"};
  const admin={from(table){const q={select(){return q;},gte(){return q;},lte(){return q;},eq(){return q;},
    order(){return table==="classes"?Promise.resolve({data:[{id:"class",name:"XI RPL 1"}]}):q;},
    async limit(){return {data:[record]};},async in(){return {data:[{id:"student",full_name:"Siswa Contoh",nis:"CONTOH-123"}]};}};return q;}};
  const load=createTsLoader({"@/lib/supabase/admin":{createAdminClient:()=>admin}});
  const {loadRekap}=load("src/features/rekap/data");
  const data=await loadRekap({from:"2026-11-01",to:"2026-11-30",kelas:"",jenis:"",q:""});
  assert.equal(data.total,1);assert.equal(data.rows[0].lessonPeriodEnd,5);
  assert.equal(Object.hasOwn(data,"lateReturns"),false);
  assert.equal(Object.hasOwn(data.rows[0],"lateMinutes"),false);
  const {buildRekapXlsx,buildRekapPdf}=load("src/features/rekap/export");
  const bytes=await buildRekapXlsx(data,new Date("2026-11-03T05:00:00Z"));
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(bytes));
  const sheet=workbook.getWorksheet("Data Pengajuan");
  const headings=sheet.getRow(1).values.join(" ");
  assert.match(headings,/Jam Pelajaran/);assert.match(headings,/Sampai \(WIB\)/);
  assert.doesNotMatch(headings,/Terlambat|Kembali|Durasi Dispen/);
  assert.match(sheet.getRow(2).values.join(" "),/Jam ke-3 s.d. ke-5/);
  assert.ok((await PDFDocument.load(await buildRekapPdf(data,new Date("2026-11-03T05:00:00Z")))).getPageCount()>0);
});
