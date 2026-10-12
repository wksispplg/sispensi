-- ============================================================================
-- SIPENSI — Migrasi 0012: Cegah data dobel di level database
--
-- Pemindaian 2026-10-09 menemukan data masih bersih, tetapi tiga celah ini
-- memungkinkan data dobel muncul. Aturan di DB berlaku untuk SEMUA jalur
-- (form, impor Excel, dua tab sekaligus, maupun panggilan API langsung).
--
--   1) Satu siswa hanya boleh punya SATU pengajuan berstatus 'pending' per
--      jenis izin (mencegah kirim ganda dari dua tab / klik ganda).
--   2) Nama kelas & mata pelajaran unik tanpa membedakan huruf besar/kecil
--      dan spasi ("XI RPL 1" = "xi  rpl 1").
--   3) Jadwal satu kelas tidak boleh tumpang tindih pada hari yang sama
--      (jam yang hanya bersentuhan, mis. 07:00–08:00 & 08:00–09:00, boleh).
--
-- Bila Run gagal dengan pesan "could not create unique index" / "conflicting
-- key value", berarti ada data dobel lama yang harus dibereskan dulu.
--
-- Prasyarat: 0001–0011. Cara jalan: SQL Editor > tempel > Run (aman diulang).
-- ============================================================================

-- 1) Satu pengajuan menunggu per siswa per jenis izin -----------------------
create unique index if not exists pr_one_pending_per_type
  on public.permission_requests (student_id, izin_type)
  where status = 'pending';

-- 2) Nama kelas & mapel unik setelah dinormalisasi -------------------------
create unique index if not exists classes_name_normalized_key
  on public.classes (lower(btrim(regexp_replace(name, '\s+', ' ', 'g'))));

create unique index if not exists subjects_name_normalized_key
  on public.subjects (lower(btrim(regexp_replace(name, '\s+', ' ', 'g'))));

-- 3) Jadwal per kelas tidak boleh bentrok ----------------------------------
-- btree_gist diperlukan agar kolom uuid/smallint bisa dipakai di constraint
-- EXCLUDE bersama rentang waktu.
create extension if not exists btree_gist with schema extensions;

alter table public.schedules drop constraint if exists schedules_no_overlap;
alter table public.schedules
  add constraint schedules_no_overlap
  exclude using gist (
    class_id with =,
    day_of_week with =,
    -- rentang menit-dalam-hari, batas [mulai, selesai)
    int4range(
      (extract(epoch from start_time) / 60)::int,
      (extract(epoch from end_time) / 60)::int
    ) with &&
  );
