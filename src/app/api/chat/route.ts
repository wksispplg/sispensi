import { z } from "zod";

import { CHAT_MAX_LENGTH } from "@/features/chatbot/contract";
import { findTopic } from "@/features/chatbot/knowledge";
import { checkChatRateLimit } from "@/features/chatbot/rate-limit";
import { createChatReply } from "@/features/chatbot/service";

export const runtime = "nodejs";

const payloadSchema = z.object({
  message: z.string().trim().min(1).max(CHAT_MAX_LENGTH),
  topic: z.string().max(30).nullable().optional(),
}).strict();

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...extraHeaders } });
}

async function readBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8_192) {
        await reader.cancel();
        throw new Error("large");
      }
      chunks.push(value);
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const allowedOrigins = new Set([new URL(request.url).origin]);
  try {
    if (process.env.NEXT_PUBLIC_APP_URL) allowedOrigins.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
  } catch { /* URL opsional yang tidak valid tidak menambah origin yang diizinkan. */ }
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && !allowedOrigins.has(origin))) {
    return json({ error: "Permintaan harus dikirim dari website SIPENSI." }, 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "Format pesan tidak valid." }, 415);
  }
  const retryAfter = checkChatRateLimit(request.headers);
  if (retryAfter) {
    return json({ error: "Pesan terlalu sering dikirim. Tunggu sebentar, lalu coba lagi." }, 429, { "Retry-After": String(retryAfter) });
  }

  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(JSON.parse(await readBody(request)));
  } catch {
    return json({ error: `Pesan harus berisi 1–${CHAT_MAX_LENGTH} karakter dengan format yang valid.` }, 400);
  }
  const reply = await createChatReply(payload.message, findTopic(payload.topic ?? undefined)?.id);
  return json(reply);
}
