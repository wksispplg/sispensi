"use client";

import { useState } from "react";
import { PdfPreview } from "./pdf-preview";

import { cn } from "@/lib/utils";
import { StudentEmpty, requestTitle, studentDate } from "@/features/izin/student-view";
import { getLetterNumber } from "@/features/surat/qr";
import { studentLetterState, type StudentLetter } from "@/features/surat/student-letters";

export function DigitalLetters({ letters, initialRequestId, now }: { letters: StudentLetter[]; initialRequestId?: string; now: number }) {
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(letters.find((letter) => letter.request_id === initialRequestId)?.id ?? letters[0]?.id ?? "");
  const [showAll, setShowAll] = useState(false);
  const filtered = letters.filter((letter) => filter === "all" || (filter === "finished" ? studentLetterState(letter, now) === "finished" : studentLetterState(letter, now) !== "finished"));
  const visible = showAll ? filtered : filtered.slice(0, 3);
  const selected = filtered.find((letter) => letter.id === selectedId) ?? filtered[0];

  return <div className="grid min-w-0 items-start gap-4 pt-2 lg:grid-cols-[minmax(275px,0.85fr)_minmax(0,1.15fr)] lg:pt-3">
    <div className="flex min-w-0 flex-col gap-4">
      <section className="student-panel px-5 py-6 sm:px-6">
        <div aria-label="Filter surat izin" className="mb-5 flex flex-wrap gap-2">
          {[["all", "Semua"], ["active", "Aktif"], ["finished", "Selesai"]].map(([value, label]) => <button key={value} type="button" className="student-tab" aria-pressed={filter === value} onClick={() => { setFilter(value); setShowAll(false); }}>{label}</button>)}
        </div>
        {visible.length ? <ul className="space-y-3">{visible.map((letter) => <li key={letter.id}>
          <button type="button" onClick={() => setSelectedId(letter.id)} aria-pressed={selected?.id === letter.id} className={cn("w-full min-w-0 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500", selected?.id === letter.id ? "border-[#ff3030]" : "border-[#dce1e9] hover:border-red-300")}>
            <div className="mb-2 flex items-start justify-between gap-2"><h2 className="min-w-0 truncate text-xs font-medium">{requestTitle(letter.permission_requests.reason)}</h2><LetterState letter={letter} now={now} /></div>
            <p className="text-[11px] text-[#6f7380]">{studentDate.format(new Date(letter.issued_at))}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-[#6f7380] wrap-anywhere">No. {getLetterNumber(letter.letter_number, letter.issued_at, letter.qr_token)}</p>
          </button>
        </li>)}</ul> : <StudentEmpty title="Belum ada surat izin" description={letters.length ? "Tidak ada surat pada filter ini." : "Surat akan terbit setelah pengajuan Anda disetujui guru."} />}
        {filtered.length > 3 ? <button type="button" onClick={() => setShowAll((value) => !value)} className="mx-auto mt-3 block min-h-9 text-[11px] underline underline-offset-2">{showAll ? "Tampilkan lebih sedikit" : `Tampilkan semua (${filtered.length})`}</button> : null}
      </section>
      <section className="student-panel p-6 text-xs leading-relaxed">
        <h2 className="mb-3 font-semibold">Cara menggunakan surat:</h2>
        <ol className="list-decimal space-y-1 pl-4 text-[#6f7380]">
          <li>Unduh PDF atau tunjukkan surat digital ini.</li>
          <li>Guru memeriksa data dan memindai QR pada surat.</li>
          <li>Gunakan surat sesuai waktu izin yang disetujui.</li>
        </ol>
        <p className="mt-5 text-[#6f7380]">Surat hanya terbit untuk pengajuan yang disetujui.</p>
      </section>
    </div>
    <section aria-label="Pratinjau surat" className="student-panel min-w-0 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><h2 className="text-xs font-semibold">Pratinjau surat</h2>{selected ? <LetterState letter={selected} now={now} /> : null}</div>
        {selected ? <a href={`/surat/${selected.qr_token}`} className="student-button min-h-8 px-4 py-1.5">Unduh PDF</a> : null}
      </div>
      {selected ? <PdfPreview key={selected.qr_token} token={selected.qr_token} /> : <div className="flex min-h-96 items-center justify-center rounded-2xl bg-[#f5f6f8] p-6 text-center text-xs text-[#6f7380]">Pilih surat untuk melihat pratinjau.</div>}
    </section>
  </div>;
}

function LetterState({ letter, now }: { letter: StudentLetter; now: number }) {
  const state = studentLetterState(letter, now);
  return <span className={cn("shrink-0 rounded-full px-3 py-1 text-[10px]", state === "finished" ? "bg-zinc-200 text-zinc-500" : state === "scheduled" ? "bg-amber-50 text-amber-700" : "bg-[#dcffda] text-[#3a7c00]")}>{state === "finished" ? "Selesai" : state === "scheduled" ? "Terjadwal" : "Berlaku"}</span>;
}

