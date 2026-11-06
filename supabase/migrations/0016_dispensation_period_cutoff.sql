-- Cegah pengajuan dispensasi baru setelah jam mulai berakhir (WIB).
-- Prasyarat: 0001-0015. Pengajuan lama dan Izin Masuk Kelas dipertahankan.
begin;

create or replace function public.enforce_dispensation_period_cutoff()
returns trigger language plpgsql set search_path = '' as $$
declare
  local_now timestamp := statement_timestamp() at time zone 'Asia/Jakarta';
begin
  if new.izin_type = 'masuk_kelas'
    or auth.uid() is distinct from new.student_id
    or public.current_user_role() is distinct from 'siswa'
  then
    return new;
  end if;

  if not coalesce(
    (new.requested_at at time zone 'Asia/Jakarta')::date = local_now::date
    and local_now::time < public.lesson_period_clock(new.lesson_period_start, true),
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
