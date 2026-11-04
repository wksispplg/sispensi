import "server-only";

import { analysisSchema, type AnalysisPatterns, type AnalysisResult } from "./contract";

// Diadaptasi dari fitur AI BK mezzaluna-azzafira/sipensi, commit c03a2d2.
// Riwayat timer versi lama diganti pola jam pelajaran dan agregat tanpa identitas.
const CACHE_TTL = 10 * 60_000;
const REFRESH_MIN = 30_000;
const cache = new Map<string, { at: number; data: AnalysisResult }>();
const inFlight = new Map<string, Promise<Outcome>>();
type Outcome = { source: "gemini" | "fallback"; cached: boolean; data: AnalysisResult; warning?: string };

export function buildFallback(patterns: AnalysisPatterns): AnalysisResult {
  const { analyzed, total, recent30Days } = patterns;
  const highest = Object.entries(patterns.byType).sort((a, b) => b[1] - a[1])[0];
  const level = recent30Days >= 8 ? "Tinggi" : recent30Days >= 4 ? "Sedang" : "Rendah";
  if (!analyzed) return { ringkasan_pola: "Belum ada riwayat pengajuan izin yang dapat dianalisis.", tingkat_risiko: "Rendah", rekomendasi_bk: ["Belum diperlukan kesimpulan pola izin. Tinjau kembali setelah tersedia riwayat pengajuan."] };
  return {
    ringkasan_pola: `Dianalisis ${analyzed} dari ${total} pengajuan terbaru. Jenis terbanyak: ${highest?.[0] ?? "belum tersedia"} (${highest?.[1] ?? 0} pengajuan). Dalam sampel ini, ${recent30Days} pengajuan yang tidak dibatalkan memiliki waktu izin pada 30 hari terakhir.${analyzed < 3 ? " Data masih sedikit sehingga kesimpulan pola terbatas." : ""}`,
    tingkat_risiko: level,
    rekomendasi_bk: level === "Rendah"
      ? ["Tinjau riwayat secara berkala dan konfirmasikan kebutuhan pendampingan bersama siswa bila diperlukan.", "Frekuensi izin saja tidak membuktikan adanya pelanggaran kedisiplinan."]
      : ["Ajak siswa berdiskusi untuk memahami kebutuhan di balik pengajuan izin yang berulang.", "Bila diperlukan, koordinasikan pendampingan dengan wali kelas setelah konteks pengajuan dikonfirmasi.", "Gunakan data ini sebagai bahan percakapan, bukan dasar otomatis untuk menolak izin atau memberi sanksi."],
  };
}

const instruction = `Kamu adalah asisten Guru BK SMK. Buat ringkasan pola izin dan saran pendampingan satu siswa dari hitungan agregat.
Identitas dan teks alasan sengaja tidak diberikan. Jangan mengarang alasan, diagnosis, tingkat kedisiplinan, atau keterlambatan kembali.
Frekuensi izin bukan bukti pelanggaran. Tingkat risiko hanya berarti prioritas meninjau pola izin, bukan sifat siswa.
Jangan menyarankan penolakan izin, hukuman, penilaian akademik atau diagnosis. Guru tetap menentukan tindak lanjut.
Data merupakan paling banyak 40 pengajuan terbaru; total adalah jumlah seluruh riwayat. Jangan menyamakan sampel dengan seluruh data.
byWeekday dan byLessonPeriod berasal dari waktu izin dalam WIB. recent30Days hanya hitungan sampel yang tidak dibatalkan pada 30 hari terakhir.
repeatedReasonCounts hanya frekuensi alasan yang sama; teksnya tidak diketahui. Jangan menyimpulkan alasan janggal/palsu.
Jika analyzed < 3, nyatakan bahwa data terbatas. Gunakan Bahasa Indonesia suportif.
Jawab hanya JSON: {"ringkasan_pola":"2–3 kalimat", "tingkat_risiko":"Rendah atau Sedang atau Tinggi", "rekomendasi_bk":["saran 1","saran 2"]}.`;

export async function analyzePatterns(viewerId: string, studentId: string, fingerprint: string, patterns: AnalysisPatterns, refresh = false): Promise<Outcome> {
  if (!patterns.analyzed) return { source: "fallback", cached: false, warning: "Belum ada riwayat izin untuk dianalisis.", data: buildFallback(patterns) };
  const key = process.env.GEMINI_API_KEY?.trim().replace(/^["']|["']$/g, "");
  const configuredModel = process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite";
  const fallback = (): Outcome => ({ source: "fallback", cached: false, warning: "AI belum tersedia. Berikut ringkasan otomatis berbasis aturan, bukan hasil AI.", data: buildFallback(patterns) });
  if (!key || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(configuredModel)) return fallback();
  const cacheKey = `${viewerId}:${studentId}:${fingerprint}:${configuredModel}`;
  const now = Date.now();
  for (const [id, hit] of cache) if (now - hit.at >= CACHE_TTL) cache.delete(id);
  const hit = cache.get(cacheKey);
  if (hit && now - hit.at < (refresh ? REFRESH_MIN : CACHE_TTL)) return { source: "gemini", cached: true, data: hit.data };
  const running = inFlight.get(cacheKey);
  if (running) return running;
  if (inFlight.size >= 4) return fallback();

  const work = (async (): Promise<Outcome> => {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${configuredModel}:generateContent`, {
        method: "POST", cache: "no-store", signal: AbortSignal.timeout(20_000),
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instruction }] },
          contents: [{ role: "user", parts: [{ text: JSON.stringify(patterns) }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: "application/json" },
        }),
      });
      if (!response.ok) return fallback();
      const body = await response.json();
      const candidate = body?.candidates?.[0];
      if (candidate?.finishReason !== "STOP") return fallback();
      const text = (candidate.content?.parts ?? []).filter((part: { text?: unknown; thought?: boolean }) => typeof part.text === "string" && !part.thought).map((part: { text: string }) => part.text).join("");
      const parsed = analysisSchema.safeParse(JSON.parse(text));
      if (!parsed.success) return fallback();
      if (cache.size >= 200) cache.delete(cache.keys().next().value!);
      cache.set(cacheKey, { at: Date.now(), data: parsed.data });
      return { source: "gemini", cached: false, data: parsed.data };
    } catch { return fallback(); }
  })();
  inFlight.set(cacheKey, work);
  try { return await work; } finally { inFlight.delete(cacheKey); }
}
