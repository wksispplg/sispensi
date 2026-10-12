-- ============================================================================
-- SIPENSI — Migrasi 0011: Perbaikan hasil uji menyeluruh (2026-10-08)
--
-- 1) verify_letter TIDAK ADA di database (migrasi 0006 belum pernah dijalankan),
--    sehingga halaman /verify (scan QR) selalu menampilkan "Surat tidak
--    ditemukan" walau suratnya sah. Dibuat ulang di sini (isi sama dengan 0006).
--
-- 2) CELAH: fungsi job terjadwal bisa dipanggil SIAPA SAJA (bahkan tanpa login)
--    lewat REST. `revoke ... from public` di migrasi sebelumnya tidak cukup,
--    karena Supabase memberi hak EXECUTE langsung ke role `anon` dan
--    `authenticated` untuk setiap fungsi baru. Dicabut eksplisit di sini.
--    pg_cron berjalan sebagai postgres, jadi jadwal tetap berjalan normal.
--
-- Prasyarat: 0001–0010. Cara jalan: SQL Editor > tempel > Run (aman diulang).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Verifikasi surat publik (FR-7)
-- ---------------------------------------------------------------------------
create or replace function public.verify_letter(p_token uuid)
returns table (
  valid boolean,
  student_name text,
  class_name text,
  izin_type public.izin_type,
  requested_at timestamptz,
  status public.request_status,
  issued_at timestamptz,
  decided_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (pr.status = 'approved') as valid,
    s.full_name  as student_name,
    c.name       as class_name,
    pr.izin_type,
    pr.requested_at,
    pr.status,
    dl.issued_at,
    pr.decided_at
  from public.digital_letters dl
  join public.permission_requests pr on pr.id = dl.request_id
  join public.profiles s on s.id = pr.student_id
  left join public.classes c on c.id = pr.class_id
  where dl.qr_token = p_token;
$$;

grant execute on function public.verify_letter(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Fungsi internal: hanya job terjadwal / server (service_role)
-- ---------------------------------------------------------------------------
revoke execute on function public.escalate_overdue_requests()  from public, anon, authenticated;
revoke execute on function public.auto_reject_stale_requests() from public, anon, authenticated;
revoke execute on function public.detect_layer1_approver(uuid, timestamptz) from public, anon, authenticated;

grant execute on function public.escalate_overdue_requests()  to service_role;
grant execute on function public.auto_reject_stale_requests() to service_role;

-- Muat ulang cache skema PostgREST agar fungsi baru langsung terlihat.
notify pgrst, 'reload schema';
