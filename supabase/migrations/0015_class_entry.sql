-- Izin Masuk Kelas: satu jam mapel, alasan/bukti dan alur persetujuan tetap sama.
-- Prasyarat 0001-0014. Aman diulang; pengajuan lama tidak diubah.
begin;

alter type public.izin_type add value if not exists 'masuk_kelas';

alter table public.permission_requests drop constraint if exists pr_class_entry_single_period;
alter table public.permission_requests add constraint pr_class_entry_single_period check (
  -- Bandingkan sebagai text agar nilai enum baru aman dalam transaksi yang sama.
  izin_type::text <> 'masuk_kelas'
  or (lesson_period_start is not null and lesson_period_end is not null
      and lesson_period_start = lesson_period_end)
);

notify pgrst, 'reload schema';
commit;
