import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { AnalysisDataError, loadStudentPatterns } from "@/features/bk-ai/data";
import { analyzePatterns } from "@/features/bk-ai/service";
import { checkAnalysisRateLimit } from "@/features/bk-ai/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 40;

const payloadSchema = z.object({ studentId: z.uuid(), refresh: z.boolean().optional() }).strict();
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

async function readPayload(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) { await reader.cancel(); throw new Error("large"); }
      chunks.push(value);
    }
    return payloadSchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))));
  } finally { reader.releaseLock(); }
}

export async function POST(request: Request) {
  try {
    const profile = await getProfile();
    if (!profile) return json({ success: false, error: "Silakan login terlebih dahulu." }, 401);
    if (profile.role !== ROLES.GURU_BK) return json({ success: false, error: "Analisis ini khusus untuk Guru BK." }, 403);
    const origin = request.headers.get("origin");
    if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(request.url).origin)) return json({ success: false, error: "Permintaan harus berasal dari website SIPENSI." }, 403);
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return json({ success: false, error: "Format permintaan harus JSON." }, 415);
    let payload: z.infer<typeof payloadSchema>;
    try { payload = await readPayload(request); }
    catch { return json({ success: false, error: "Pilih siswa yang valid untuk dianalisis." }, 400); }
    const retryAfter = checkAnalysisRateLimit(profile.id);
    if (retryAfter) return json({ success: false, error: "Analisis terlalu sering diminta. Tunggu sebentar, lalu coba lagi." }, 429, { "Retry-After": String(retryAfter) });
    const { patterns, fingerprint } = await loadStudentPatterns(payload.studentId);
    const result = await analyzePatterns(profile.id, payload.studentId, fingerprint, patterns, payload.refresh);
    return json({ success: true, ...result, scope: { total: patterns.total, analyzed: patterns.analyzed, from: patterns.from, to: patterns.to } });
  } catch (error) {
    if (error instanceof AnalysisDataError) return json({ success: false, error: error.message }, error.status);
    return json({ success: false, error: "Analisis belum dapat dimuat. Silakan coba lagi." }, 503);
  }
}
