export const LETTER_TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getLetterNumber(stored: string | null, issuedAt: string, token: string): string {
  if (stored) return stored;
  const year = new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(issuedAt));
  return `SIP/${year}/${token.replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

export function letterVerificationUrl(token: string, requestUrl: string, configuredUrl?: string): string {
  if (!LETTER_TOKEN_PATTERN.test(token)) throw new Error("Token surat tidak valid.");
  const request = new URL(requestUrl);
  const base = new URL(configuredUrl?.trim() || request.origin);
  if (!["https:", "http:"].includes(base.protocol) || base.username || base.password) throw new Error("URL aplikasi tidak valid.");
  const local = (hostname: string) => ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
  if (!local(request.hostname) && local(base.hostname)) throw new Error("URL publik aplikasi masih memakai localhost.");
  return new URL(`/verify/${token.toLowerCase()}`, base.origin).href;
}

/** Hanya ambil token; hasil scan tidak dipakai untuk membuka URL asing. */
export function extractLetterToken(value: string, currentOrigin: string, configuredOrigin?: string): string | null {
  const input = value.trim();
  if (LETTER_TOKEN_PATTERN.test(input)) return input.toLowerCase();
  if (input.length > 2048) return null;
  try {
    const url = new URL(input, currentOrigin);
    const allowed = [new URL(currentOrigin).origin];
    if (configuredOrigin) allowed.push(new URL(configuredOrigin).origin);
    if (!allowed.includes(url.origin) || url.username || url.password || url.search || url.hash) return null;
    const match = url.pathname.match(/^\/verify\/([^/]+)\/?$/);
    return match && LETTER_TOKEN_PATTERN.test(match[1]) ? match[1].toLowerCase() : null;
  } catch { return null; }
}
