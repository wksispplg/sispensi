-- ============================================================================
-- SIPENSI — Migrasi 0010: Jadwalkan eskalasi otomatis (FR-5) + perbaikan
--
-- 1) Perbaikan escalate_overdue_requests(): Lapis 2 DILEWATI (langsung ke
--    Lapis 3 / Guru BK) bila:
--      - kelas tidak punya Wali Kelas, atau
--      - Wali Kelas sudah menjadi approver Lapis 1 (fallback tanpa jadwal).
--    Sebelumnya kasus pertama membuat pengajuan "menggantung" di Lapis 2 tanpa
--    approver (tak ada yang bisa memutuskan) dan BK menerima notifikasi Lapis 3
--    yang keliru; kasus kedua memberi orang yang sama 20 menit lagi.
--
-- 2) Jadwal pg_cron tiap menit dengan nama job 'sipensi-escalate'. Bila job ini
--    sudah pernah dibuat manual, cron.schedule memperbaruinya (tidak dobel).
--    Job lain yang menjalankan fungsi yang sama dihapus agar tidak dobel.
--
-- Timeout tiap lapis tetap dari tabel escalation_settings (default 20/20/30).
-- Lapis 3 final; bila tetap tidak diputuskan, migrasi 0009 menolak otomatis
-- setelah 1 hari.
--
-- Prasyarat: 0001–0009. Cara jalan: SQL Editor > tempel > Run.
-- ============================================================================

create or replace function public.escalate_overdue_requests()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r public.permission_requests;
  v_count integer := 0;
  v_next_layer smallint;
  v_next_approver uuid;
  v_timeout integer;
begin
  for r in
    select * from public.permission_requests
    where status = 'pending'
      and current_layer < 3
      and current_deadline is not null
      and current_deadline < now()
    for update skip locked
  loop
    v_next_layer := (r.current_layer + 1)::smallint;
    v_next_approver := null;

    if v_next_layer = 2 then
      select c.homeroom_teacher_id into v_next_approver
      from public.classes c where c.id = r.class_id;

      -- Tak ada Wali Kelas, atau Wali Kelas sudah memegang Lapis 1 → ke Guru BK.
      if v_next_approver is null or v_next_approver = r.current_approver_id then
        v_next_layer := 3;
        v_next_approver := null;
      end if;
    end if;
    -- Lapis 3: current_approver_id NULL = siapa pun Guru BK.

    select timeout_minutes into v_timeout
    from public.escalation_settings where layer = v_next_layer;

    update public.permission_requests
      set current_layer       = v_next_layer,
          current_approver_id = v_next_approver,
          matched_schedule_id = null,
          current_deadline    = now() + make_interval(mins => coalesce(v_timeout, 20)),
          updated_at          = now()
    where id = r.id;

    insert into public.approval_logs (request_id, layer, approver_id, action, note)
    values (r.id, r.current_layer, null, 'escalated',
            format('Timeout Lapis %s — eskalasi otomatis ke Lapis %s',
                   r.current_layer, v_next_layer));

    if v_next_approver is not null then
      insert into public.notifications (user_id, request_id, title, message)
      values (v_next_approver, r.id, 'Eskalasi pengajuan izin',
              format('Pengajuan izin dieskalasi ke Anda (Lapis %s).', v_next_layer));
    else
      insert into public.notifications (user_id, request_id, title, message)
      select p.id, r.id, 'Eskalasi pengajuan izin',
             'Pengajuan izin dieskalasi ke Guru BK (Lapis 3).'
      from public.profiles p where p.role = 'guru_bk';
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Tetap hanya untuk job terjadwal / server.
revoke all on function public.escalate_overdue_requests() from public;
grant execute on function public.escalate_overdue_requests() to service_role;

-- ---------------------------------------------------------------------------
-- Jadwal
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;

-- Hapus job lain (nama berbeda) yang menjalankan fungsi yang sama.
select cron.unschedule(jobid)
from cron.job
where command ilike '%escalate_overdue_requests%'
  and jobname is distinct from 'sipensi-escalate';

select cron.schedule(
  'sipensi-escalate',
  '* * * * *',
  $$select public.escalate_overdue_requests();$$
);

-- Cek setelah dijalankan:
--   select jobname, schedule, active from cron.job;
--   select jobid, status, return_message, start_time
--     from cron.job_run_details order by start_time desc limit 10;
