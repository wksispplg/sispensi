-- SIPENSI: guru Lapis 1 mengikuti WAKTU IZIN, bukan waktu tombol kirim ditekan.
-- Prasyarat 0001-0012. Jalankan di SQL Editor Supabase proyek yang sudah ada.
-- Aman diulang. Tidak mengubah pengajuan yang sudah diputuskan/naik lapis.
begin;

create or replace function public.detect_layer1_approver(p_class uuid, p_at timestamptz)
returns table (approver_id uuid, schedule_id uuid)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_local timestamp := p_at at time zone 'Asia/Jakarta';
begin
  if p_class is null then
    approver_id := null; schedule_id := null;
    return next; return;
  end if;

  select s.teacher_id, s.id into approver_id, schedule_id
  from public.schedules s
  join public.profiles teacher on teacher.id = s.teacher_id
  where s.class_id = p_class
    and s.day_of_week = extract(isodow from v_local)::smallint
    and v_local::time >= s.start_time and v_local::time < s.end_time
    and teacher.role in ('guru_mapel', 'wali_kelas', 'guru_bk', 'admin')
  order by s.start_time, s.id limit 1;
  if found then return next; return; end if;

  select teacher.id, null::uuid into approver_id, schedule_id
  from public.classes c
  join public.profiles teacher on teacher.id = c.homeroom_teacher_id
  where c.id = p_class
    and teacher.role in ('guru_mapel', 'wali_kelas', 'guru_bk', 'admin');
  return next;
end;
$$;

revoke execute on function public.detect_layer1_approver(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.detect_layer1_approver(uuid, timestamptz) to service_role;

create or replace function public.assign_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_approver uuid;
  v_schedule uuid;
  v_timeout integer;
begin
  select approver_id, schedule_id into v_approver, v_schedule
  from public.detect_layer1_approver(new.class_id, new.requested_at);
  if v_approver is null then
    raise exception 'Guru pada waktu izin dan wali kelas belum tersedia. Hubungi Admin untuk melengkapi jadwal atau wali kelas.';
  end if;

  select timeout_minutes into v_timeout from public.escalation_settings where layer = 1;
  update public.permission_requests
  set current_approver_id = v_approver, matched_schedule_id = v_schedule,
      current_deadline = new.created_at + make_interval(mins => coalesce(v_timeout, 20))
  where id = new.id;

  insert into public.approval_logs (request_id, layer, approver_id, action, note)
  values (new.id, 1, null, 'submitted', 'Pengajuan dibuat oleh siswa');
  insert into public.notifications (user_id, request_id, title, message)
  values (v_approver, new.id, 'Pengajuan izin baru',
    'Ada pengajuan izin siswa menunggu persetujuan Anda (Lapis 1).');
  return null;
end;
$$;

-- Perbaiki hanya pengajuan yang MASIH menunggu di Lapis 1 dan salah diarahkan.
do $$
declare
  r record;
  v_approver uuid;
  v_schedule uuid;
  v_timeout integer;
  v_changed integer := 0;
begin
  select timeout_minutes into v_timeout from public.escalation_settings where layer = 1;
  for r in select id, class_id, requested_at, current_approver_id, matched_schedule_id
    from public.permission_requests where status = 'pending' and current_layer = 1 for update
  loop
    select approver_id, schedule_id into v_approver, v_schedule
    from public.detect_layer1_approver(r.class_id, r.requested_at);
    -- Tidak menebak guru bila data jadwal/perwalian lama belum lengkap.
    if v_approver is not null and (r.current_approver_id is distinct from v_approver
       or r.matched_schedule_id is distinct from v_schedule) then
      update public.permission_requests
      set current_approver_id = v_approver, matched_schedule_id = v_schedule,
          current_deadline = case when r.current_approver_id is distinct from v_approver
            then now() + make_interval(mins => coalesce(v_timeout, 20)) else current_deadline end,
          updated_at = now()
      where id = r.id;

      if r.current_approver_id is distinct from v_approver then
        -- Notifikasi penerima lama tidak lagi menunjuk pengajuan yang dialihkan.
        update public.notifications set is_read = true, request_id = null,
          title = 'Penanggung jawab izin diperbarui',
          message = 'Pengajuan ini telah diarahkan ulang kepada guru sesuai waktu izin.'
        where request_id = r.id and user_id = r.current_approver_id and title = 'Pengajuan izin baru';
        insert into public.notifications (user_id, request_id, title, message)
        values (v_approver, r.id, 'Pengajuan izin baru',
          'Pengajuan izin diarahkan kepada Anda sesuai jadwal waktu izin (Lapis 1).');
      end if;
      insert into public.approval_logs (request_id, layer, approver_id, action, note)
      values (r.id, 1, null, 'submitted', 'Penanggung jawab Lapis 1 disesuaikan dengan waktu izin.');
      v_changed := v_changed + 1;
    end if;
  end loop;
  raise notice 'Pengajuan Lapis 1 yang diperbaiki: %', v_changed;
end;
$$;

notify pgrst, 'reload schema';
commit;
