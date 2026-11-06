-- Slot demo satu hari, 6 November 2026 WIB. Prasyarat 0001–0015.
-- Termasuk pemeriksaan batas waktu pengajuan dari migrasi 0016.
begin;

create or replace function public.lesson_period_clock(p_period integer, p_end boolean, p_date date)
returns time language sql immutable set search_path = '' as $$
  select case
    when p_period = 13 and p_date = date '2026-11-06'
      then case when p_end then time '23:59' else time '16:00' end
    else public.lesson_period_clock(p_period, p_end)
  end;
$$;

alter table public.permission_requests drop constraint if exists pr_lesson_period_range;
alter table public.permission_requests add constraint pr_lesson_period_range check (
  (lesson_period_start is null and lesson_period_end is null and requested_until is null)
  or (
    lesson_period_start is not null and lesson_period_end is not null and requested_until is not null
    and lesson_period_end >= lesson_period_start
    and requested_until > requested_at
    and (requested_at at time zone 'Asia/Jakarta')::date = (requested_until at time zone 'Asia/Jakarta')::date
    and ((requested_at at time zone 'Asia/Jakarta')::time = public.lesson_period_clock(
      lesson_period_start, false, (requested_at at time zone 'Asia/Jakarta')::date
    )) is true
    and ((requested_until at time zone 'Asia/Jakarta')::time = public.lesson_period_clock(
      lesson_period_end, true, (requested_until at time zone 'Asia/Jakarta')::date
    )) is true
  )
);

create or replace function public.enforce_dispensation_period_cutoff()
returns trigger language plpgsql set search_path = '' as $$
declare
  local_now timestamp := statement_timestamp() at time zone 'Asia/Jakarta';
begin
  if (new.izin_type = 'masuk_kelas' and new.lesson_period_start is distinct from 13)
    or auth.uid() is distinct from new.student_id
    or public.current_user_role() is distinct from 'siswa'
  then
    return new;
  end if;

  if not coalesce(
    (new.requested_at at time zone 'Asia/Jakarta')::date = local_now::date
    and local_now::time < public.lesson_period_clock(new.lesson_period_start, true, local_now::date),
    false
  ) then
    raise exception 'dispensation_period_ended' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists permission_requests_dispensation_cutoff on public.permission_requests;
create trigger permission_requests_dispensation_cutoff
before insert on public.permission_requests
for each row execute function public.enforce_dispensation_period_cutoff();

commit;
