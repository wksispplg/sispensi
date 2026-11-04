-- Rentang jam pelajaran dan penghentian fitur pemantauan/timer dispen.
-- Prasyarat: 0001-0013. Aman diulang; catatan pengajuan lama dipertahankan.
begin;

alter table public.permission_requests
  add column if not exists lesson_period_start smallint,
  add column if not exists lesson_period_end smallint,
  add column if not exists requested_until timestamptz;

-- Jam sekolah yang sama dengan LESSON_PERIODS pada aplikasi.
create or replace function public.lesson_period_clock(p_period integer, p_end boolean)
returns time language sql immutable set search_path = '' as $$
  select case when p_end then v.ends else v.starts end
  from (values
    (1,time '07:10',time '07:50'),(2,time '07:50',time '08:30'),
    (3,time '09:00',time '09:40'),(4,time '09:40',time '10:20'),
    (5,time '10:20',time '11:00'),(6,time '11:00',time '11:40'),
    (7,time '11:40',time '12:20'),(8,time '13:20',time '14:00'),
    (9,time '14:00',time '14:40'),(10,time '14:40',time '15:20'),
    (11,time '15:20',time '16:00')
  ) as v(number,starts,ends) where v.number = p_period;
$$;

alter table public.permission_requests drop constraint if exists pr_lesson_period_range;
alter table public.permission_requests add constraint pr_lesson_period_range check (
  (lesson_period_start is null and lesson_period_end is null and requested_until is null)
  or (
    lesson_period_start is not null and lesson_period_end is not null and requested_until is not null
    and lesson_period_start between 1 and 11
    and lesson_period_end between lesson_period_start and 11
    and requested_until > requested_at
    and (requested_at at time zone 'Asia/Jakarta')::date = (requested_until at time zone 'Asia/Jakarta')::date
    and (requested_at at time zone 'Asia/Jakarta')::time = public.lesson_period_clock(lesson_period_start,false)
    and (requested_until at time zone 'Asia/Jakarta')::time = public.lesson_period_clock(lesson_period_end,true)
  )
);

-- Siswa baru wajib menyertakan rentang lengkap dan tidak dapat mengisi timer.
drop policy if exists pr_insert_own_student on public.permission_requests;
create policy pr_insert_own_student on public.permission_requests
for insert to authenticated with check (
  student_id = auth.uid() and public.current_user_role() = 'siswa'
  and status = 'pending' and current_layer = 1
  and current_approver_id is null and matched_schedule_id is null and current_deadline is null
  and decided_at is null and decided_by is null
  and evidence_url is not null and length(btrim(evidence_url)) > 0
  and lesson_period_start is not null and lesson_period_end is not null and requested_until is not null
  and duration_minutes is null and dispen_started_at is null and dispen_deadline is null and returned_at is null
);

-- Jalur mulai/kembali yang sudah dibatalkan tidak lagi dapat dipanggil lewat API.
drop function if exists public.start_dispen(uuid);
drop function if exists public.return_dispen(uuid);

notify pgrst, 'reload schema';
commit;
