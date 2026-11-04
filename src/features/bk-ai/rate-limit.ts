import "server-only";

const buckets = new Map<string, { count: number; resetAt: number }>();

/** Pembatas per akun BK, per instance; hasil dan identitas tidak disimpan di bucket. */
export function checkAnalysisRateLimit(userId: string, now = Date.now()): number {
  for (const [id, bucket] of buckets) if (now >= bucket.resetAt) buckets.delete(id);
  const bucket = buckets.get(userId) ?? { count: 0, resetAt: now + 60_000 };
  if (bucket.count >= 12 || (!buckets.has(userId) && buckets.size >= 500)) return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  bucket.count++;
  buckets.set(userId, bucket);
  return 0;
}
