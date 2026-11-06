import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { projectRoot } from "./helpers/load-ts.mjs";

const classId="00000000-0000-4000-8000-000000000001";
const emptyClass="00000000-0000-4000-8000-000000000002";
const teacherA="10000000-0000-4000-8000-000000000001";
const teacherB="10000000-0000-4000-8000-000000000002";
const teacherBk="10000000-0000-4000-8000-000000000003";
const wali="10000000-0000-4000-8000-000000000004";
const student="10000000-0000-4000-8000-000000000005";
const pendingId="20000000-0000-4000-8000-000000000001";
const approvedId="20000000-0000-4000-8000-000000000002";
const layer2Id="20000000-0000-4000-8000-000000000003";
const migration=fs.readFileSync(path.join(projectRoot,"supabase/migrations/0013_route_by_requested_period.sql"),"utf8");

test("migrasi dan trigger PostgreSQL mengarahkan izin sesuai waktu izin secara atomik", async (t) => {
  const db=new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create table public.profiles(id uuid primary key,role text not null);
      create table public.classes(id uuid primary key,homeroom_teacher_id uuid);
      create table public.schedules(id uuid primary key default gen_random_uuid(),class_id uuid,teacher_id uuid,day_of_week smallint,start_time time,end_time time);
      create table public.escalation_settings(layer integer,timeout_minutes integer);
      create table public.permission_requests(id uuid primary key default gen_random_uuid(),class_id uuid,status text default 'pending',current_layer integer default 1,
        current_approver_id uuid,matched_schedule_id uuid,requested_at timestamptz,created_at timestamptz default now(),current_deadline timestamptz,updated_at timestamptz default now());
      create table public.approval_logs(id bigserial primary key,request_id uuid,layer integer,approver_id uuid,action text,note text);
      create table public.notifications(id bigserial primary key,user_id uuid,request_id uuid,title text,message text,is_read boolean default false);
      create function public.assign_after_insert() returns trigger language plpgsql as $$ begin return null; end; $$;
      create trigger permission_requests_assign_after_insert after insert on public.permission_requests for each row execute function public.assign_after_insert();
      insert into public.profiles values('${teacherA}','guru_mapel'),('${teacherB}','guru_mapel'),('${teacherBk}','guru_bk'),('${wali}','wali_kelas'),('${student}','siswa');
      insert into public.classes values('${classId}','${wali}'),('${emptyClass}',null);
      insert into public.escalation_settings values(1,20);
      insert into public.schedules(class_id,teacher_id,day_of_week,start_time,end_time) values
        ('${classId}','${teacherA}',2,'07:10','07:50'),('${classId}','${teacherB}',2,'09:00','09:40'),
        ('${classId}','${teacherBk}',2,'13:20','14:00'),('${classId}','${student}',2,'10:20','11:00');
      insert into public.permission_requests(id,class_id,status,current_layer,current_approver_id,requested_at,created_at) values
        ('${pendingId}','${classId}','pending',1,'${teacherA}','2026-11-03T02:00:00Z','2026-11-03T00:20:00Z'),
        ('${approvedId}','${classId}','approved',1,'${teacherA}','2026-11-03T02:00:00Z','2026-11-03T00:20:00Z'),
        ('${layer2Id}','${classId}','pending',2,'${teacherA}','2026-11-03T02:00:00Z','2026-11-03T00:20:00Z');
      insert into public.notifications(user_id,request_id,title,message) values('${teacherA}','${pendingId}','Pengajuan izin baru','Lama');
    `);
    await db.exec(migration);
    await t.test("perbaikan hanya menyentuh pending Lapis 1, dengan notifikasi ke guru yang benar",async()=>{
      const {rows}=await db.query("select id,current_approver_id from public.permission_requests order by id");
      assert.equal(rows.find(r=>r.id===pendingId).current_approver_id,teacherB);
      assert.equal(rows.find(r=>r.id===approvedId).current_approver_id,teacherA);
      assert.equal(rows.find(r=>r.id===layer2Id).current_approver_id,teacherA);
      assert.equal((await db.query("select user_id from public.notifications where request_id=$1",[pendingId])).rows[0].user_id,teacherB);
    });
    await t.test("aman dijalankan ulang tanpa menambah notifikasi berulang",async()=>{
      const before=(await db.query("select count(*)::int as n from public.notifications")).rows[0].n;
      await db.exec(migration);
      assert.equal((await db.query("select count(*)::int as n from public.notifications")).rows[0].n,before);
    });
    await t.test("pengajuan pagi untuk jam ke-8 diterima guru jam ke-8, termasuk akun BK",async()=>{
      const row=(await db.query("insert into public.permission_requests(class_id,requested_at,created_at) values($1,'2026-11-03T06:20:00Z','2026-11-03T00:20:00Z') returning id",[classId])).rows[0];
      const actual=(await db.query("select current_approver_id,current_deadline from public.permission_requests where id=$1",[row.id])).rows[0];
      assert.equal(actual.current_approver_id,teacherBk);
      assert.equal(new Date(actual.current_deadline).toISOString(),"2026-11-03T00:40:00.000Z");
    });
    await t.test("batas akhir pelajaran dan guru tidak valid kembali ke wali kelas",async()=>{
      for(const at of ["2026-11-03T02:40:00Z","2026-11-03T03:20:00Z","2026-11-03T01:40:00Z"]){
        const row=(await db.query("insert into public.permission_requests(class_id,requested_at) values($1,$2) returning id",[classId,at])).rows[0];
        assert.equal((await db.query("select current_approver_id from public.permission_requests where id=$1",[row.id])).rows[0].current_approver_id,wali);
      }
    });
    await t.test("tanpa guru dan wali, transaksi batal tanpa pengajuan/notifikasi menggantung",async()=>{
      const before=(await db.query("select count(*)::int as n from public.permission_requests")).rows[0].n;
      await assert.rejects(()=>db.query("insert into public.permission_requests(class_id,requested_at) values($1,'2026-11-03T02:00:00Z')",[emptyClass]),/wali kelas belum tersedia/);
      assert.equal((await db.query("select count(*)::int as n from public.permission_requests")).rows[0].n,before);
    });
    await t.test("fungsi pemilihan guru tidak dibuka untuk anon/panggilan siswa",async()=>{
      const rows=(await db.query("select has_function_privilege('anon','public.detect_layer1_approver(uuid,timestamptz)','EXECUTE') as anon, has_function_privilege('authenticated','public.detect_layer1_approver(uuid,timestamptz)','EXECUTE') as authenticated")).rows;
      assert.equal(rows[0].anon,false);assert.equal(rows[0].authenticated,false);
    });
    await db.exec(`
      alter table public.permission_requests add column student_id uuid, add column evidence_url text,
        add column decided_at timestamptz, add column decided_by uuid, add column duration_minutes integer,
        add column dispen_started_at timestamptz, add column dispen_deadline timestamptz, add column returned_at timestamptz;
      create schema auth;
      create function auth.uid() returns uuid language sql as $$ select '${student}'::uuid $$;
      create function public.current_user_role() returns text language sql security definer set search_path='' as $$ select role from public.profiles where id=auth.uid() $$;
      create function public.start_dispen(uuid) returns uuid language sql as $$ select $1 $$;
      create function public.return_dispen(uuid) returns uuid language sql as $$ select $1 $$;
    `);
    const rangeMigration=fs.readFileSync(path.join(projectRoot,"supabase/migrations/0014_period_range.sql"),"utf8");
    await db.exec(rangeMigration);
    await t.test("rentang 3-5 disimpan lengkap dan guru lapis 1 mengikuti jam awal",async()=>{
      const id=(await db.query("insert into public.permission_requests(class_id,requested_at,requested_until,lesson_period_start,lesson_period_end) values($1,'2026-11-03T02:00:00Z','2026-11-03T04:00:00Z',3,5) returning id",[classId])).rows[0].id;
      const row=(await db.query("select current_approver_id,lesson_period_end from public.permission_requests where id=$1",[id])).rows[0];
      assert.equal(row.current_approver_id,teacherB);assert.equal(row.lesson_period_end,5);
    });
    await t.test("database menolak rentang terbalik, slot tidak ada dan waktu yang dipalsukan",async()=>{
      for(const [start,end,until] of [[5,3,"2026-11-03T02:40:00Z"],[3,12,"2026-11-03T09:00:00Z"],[3,5,"2026-11-03T06:00:00Z"],[3,null,"2026-11-03T04:00:00Z"]]){
        await assert.rejects(()=>db.query("insert into public.permission_requests(class_id,requested_at,requested_until,lesson_period_start,lesson_period_end) values($1,'2026-11-03T02:00:00Z',$2,$3,$4)",[classId,until,start,end]),/pr_lesson_period_range/);
      }
    });
    await t.test("data lama dipertahankan dan RPC timer sudah dihapus",async()=>{
      assert.equal((await db.query("select count(*)::int as n from public.permission_requests where id=$1 and lesson_period_end is null",[approvedId])).rows[0].n,1);
      const row=(await db.query("select to_regprocedure('public.start_dispen(uuid)') as start,to_regprocedure('public.return_dispen(uuid)') as finish")).rows[0];
      assert.equal(row.start,null);assert.equal(row.finish,null);
      await db.exec(rangeMigration);
    });
    await t.test("RLS siswa mewajibkan rentang baru dan menolak pengisian timer",async()=>{
      await db.exec(`grant usage on schema public,auth to authenticated; grant select,insert on public.permission_requests to authenticated;
        alter table public.permission_requests enable row level security;
        create policy student_read on public.permission_requests for select to authenticated using(student_id=auth.uid());
        set role authenticated;`);
      try {
        await assert.rejects(()=>db.query("insert into public.permission_requests(class_id,student_id,evidence_url,requested_at) values($1,$2,'bukti.png','2026-11-03T02:00:00Z')",[classId,student]),/row-level security/);
        await assert.rejects(()=>db.query("insert into public.permission_requests(class_id,student_id,evidence_url,requested_at,requested_until,lesson_period_start,lesson_period_end,duration_minutes) values($1,$2,'bukti.png','2026-11-03T02:00:00Z','2026-11-03T04:00:00Z',3,5,30)",[classId,student]),/row-level security/);
        await db.query("insert into public.permission_requests(class_id,student_id,evidence_url,requested_at,requested_until,lesson_period_start,lesson_period_end) values($1,$2,'bukti.png','2026-11-03T02:00:00Z','2026-11-03T04:00:00Z',3,5)",[classId,student]);
      } finally {await db.exec("reset role");}
    });
    await db.exec(`create type public.izin_type as enum ('dispensasi','lainnya');
      alter table public.permission_requests add column izin_type public.izin_type not null default 'dispensasi';`);
    const entryMigration=fs.readFileSync(path.join(projectRoot,"supabase/migrations/0015_class_entry.sql"),"utf8");
    await db.exec(entryMigration);
    await t.test("izin masuk memakai satu jam, tetap mengikuti guru pada jadwal dan dapat dimigrasikan ulang",async()=>{
      const row=(await db.query(`insert into public.permission_requests(class_id,student_id,evidence_url,izin_type,requested_at,requested_until,lesson_period_start,lesson_period_end)
        values($1,$2,'bukti.png','masuk_kelas','2026-11-03T02:00:00Z','2026-11-03T02:40:00Z',3,3) returning id`,[classId,student])).rows[0];
      const actual=(await db.query("select izin_type,lesson_period_start,lesson_period_end,current_approver_id from public.permission_requests where id=$1",[row.id])).rows[0];
      assert.equal(actual.izin_type,"masuk_kelas");assert.equal(actual.lesson_period_start,3);assert.equal(actual.lesson_period_end,3);
      assert.equal(actual.current_approver_id,teacherB);
      await db.exec(entryMigration);
      assert.equal((await db.query("select izin_type from public.permission_requests where id=$1",[approvedId])).rows[0].izin_type,"dispensasi");
    });
    await t.test("database menolak izin masuk dengan rentang atau jam kosong meski lewat API langsung",async()=>{
      await assert.rejects(()=>db.query(`insert into public.permission_requests(class_id,student_id,evidence_url,izin_type,requested_at,requested_until,lesson_period_start,lesson_period_end)
        values($1,$2,'bukti.png','masuk_kelas','2026-11-03T02:00:00Z','2026-11-03T04:00:00Z',3,5)`,[classId,student]),/pr_class_entry_single_period/);
      await assert.rejects(()=>db.query(`insert into public.permission_requests(class_id,student_id,evidence_url,izin_type,requested_at)
        values($1,$2,'bukti.png','masuk_kelas','2026-11-03T02:00:00Z')`,[classId,student]),/pr_class_entry_single_period/);
    });
    await t.test("database membatasi pengajuan dispensasi baru berdasarkan jam mulai dan tanggal WIB", async () => {
      const cutoffMigration = fs.readFileSync(path.join(projectRoot, "supabase/migrations/0016_dispensation_period_cutoff.sql"), "utf8");
      await db.exec(cutoffMigration);
      await db.exec(cutoffMigration);
      const insert = (type, dayOffset, start, end = start) => db.query(`
        with school_day as (
          select (statement_timestamp() at time zone 'Asia/Jakarta')::date + $4::int as day
        )
        insert into public.permission_requests(class_id,student_id,evidence_url,izin_type,requested_at,requested_until,lesson_period_start,lesson_period_end)
        select $1,$2,'bukti.png',$3,
          (day + public.lesson_period_clock($5,false)) at time zone 'Asia/Jakarta',
          (day + public.lesson_period_clock($6,true)) at time zone 'Asia/Jakarta',$5,$6
        from school_day`, [classId, student, type, dayOffset, start, end]);
      await db.exec("set role authenticated");
      try {
        await assert.rejects(() => insert("dispensasi", -1, 3), /dispensation_period_ended/);
        await assert.rejects(() => insert("dispensasi", 1, 3), /dispensation_period_ended/);
        await insert("masuk_kelas", -1, 3);
        const { rows: [today] } = await db.query(`select local_time < time '16:00' as open,
          local_time >= time '07:50' as first_ended
          from (select (statement_timestamp() at time zone 'Asia/Jakarta')::time as local_time) as clock`);
        if (today.first_ended) await assert.rejects(() => insert("dispensasi", 0, 1, 11), /dispensation_period_ended/);
        if (today.open) await insert("dispensasi", 0, 11);
        else await assert.rejects(() => insert("dispensasi", 0, 11), /dispensation_period_ended/);
      } finally { await db.exec("reset role"); }
      await db.query("update public.permission_requests set status = 'approved' where id = $1", [pendingId]);
      assert.equal((await db.query("select status from public.permission_requests where id = $1", [pendingId])).rows[0].status, "approved");
    });
  } finally {await db.close();}
});
