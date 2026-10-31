import "server-only";

import { createHash } from "node:crypto";

const WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; resetAt: number }>();
let globalBucket = { count: 0, resetAt: 0 };

/** Batas per proses; hosting multi-instance juga perlu pembatasan di gateway. */
export function checkChatRateLimit(headers: Headers, now = Date.now()): number {
  if (now >= globalBucket.resetAt) globalBucket = { count: 0, resetAt: now + WINDOW_MS };
  for (const [key, value] of buckets) {
    if (now >= value.resetAt) buckets.delete(key);
  }
  // Hosting harus menimpa x-forwarded-for dari klien dengan IP yang tepercaya.
  const address = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "shared";
  const key = createHash("sha256").update(address).digest("hex");
  const bucket = buckets.get(key) ?? { count: 0, resetAt: now + WINDOW_MS };
  if (globalBucket.count >= 120 || bucket.count >= 12 || (!buckets.has(key) && buckets.size >= 1000)) {
    const resetAt = Math.max(bucket.count >= 12 ? bucket.resetAt : 0, globalBucket.count >= 120 || buckets.size >= 1000 ? globalBucket.resetAt : 0);
    return Math.max(1, Math.ceil((resetAt - now) / 1000));
  }
  bucket.count++;
  globalBucket.count++;
  buckets.set(key, bucket);
  return 0;
}
