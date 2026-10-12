-- ============================================================================
-- SIPENSI — Migrasi 0009: Tolak otomatis pengajuan yang tidak ditanggapi
--
-- Aturan: pengajuan berstatus 'pending' yang sudah lebih dari 1 HARI sejak
-- diajukan (created_at) otomatis ditolak oleh sistem:
--   - status = 'rejected', decided_by = NULL (tanda keputusan sistem)
--   - dicatat di approval_logs (approver_id NULL) + catatan alasannya
--   - siswa mendapat notifikasi
-- Dijalankan tiap 10 menit oleh pg_cron (jadi penolakan terjadi paling lambat
-- ±10 menit setelah batas 1 hari). Nilai 1 hari harus sama dengan
-- AUTO_REJECT_HOURS di src/lib/constants.ts.
--
-- Prasyarat: 0001–0008. Cara jalan: SQL Editor > tempel > Run.
-- ============================================================================

create or replace function public.auto_reject_stale_requests()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r public.permission_requests;
  v_count integer := 0;
begin
  for r in
    select * from public.permission_requests
    where status = 'pending'
      and created_at < now() - interval '1 day'
    for update skip locked
  loop
    update public.permission_requests
      set status           = 'rejected',
          decided_at       = now(),
          decided_by       = null,
          current_deadline = null,
          updated_at       = now()
    where id = r.id;

    insert into public.approval_logs (request_id, layer, approver_id, action, note)
    values (r.id, r.current_layer, null, 'rejected',
            'Ditolak otomatis: tidak ditanggapi lebih dari 1 hari.');

    insert into public.notifications (user_id, request_id, title, message)
    values (r.student_id, r.id, 'Izin ditolak otomatis',
            'Pengajuan izin Anda ditolak otomatis karena tidak ditanggapi lebih dari 1 hari. Silakan ajukan ulang bila masih diperlukan.');

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Hanya untuk job terjadwal / server, bukan client.
revoke all on function public.auto_reject_stale_requests() from public;
grant execute on function public.auto_reject_stale_requests() to service_role;

-- Jadwalkan tiap 10 menit. Memakai nama job sehingga aman dijalankan ulang
-- (cron.schedule dengan nama yang sama akan memperbarui job, bukan menduplikasi).
create extension if not exists pg_cron;

select cron.schedule(
  'sipensi-auto-reject',
  '*/10 * * * *',
  $$select public.auto_reject_stale_requests();$$
);
