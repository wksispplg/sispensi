import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";
import { LOGIN_PATH } from "@/lib/constants";
import type { Database } from "@/types/database";
import { CHAT_ENDPOINT } from "@/features/chatbot/contract";

/** Rute yang boleh diakses tanpa login. */
const PUBLIC_PREFIXES = [LOGIN_PATH, "/verify", "/auth"];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true; // landing page publik
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Menyegarkan sesi Supabase pada setiap request dan menjaga rute terproteksi.
 * Dipanggil dari `src/proxy.ts` (konvensi Proxy Next.js 16, pengganti middleware).
 */
export async function updateSession(request: NextRequest) {
  // Chat publik tidak mengakses sesi atau data Supabase. Rute lain tetap dijaga.
  if (request.nextUrl.pathname === CHAT_ENDPOINT) return NextResponse.next({ request });

  let supabaseResponse = NextResponse.next({ request });
  const authHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.assign(authHeaders, headers);
          for (const [name, value] of Object.entries(authHeaders)) {
            supabaseResponse.headers.set(name, value);
          }
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();
  const hasSession = !error && !!data?.claims.sub;

  const { pathname } = request.nextUrl;
  const url = request.nextUrl.clone();

  // Belum login & mengakses rute terproteksi -> arahkan ke login.
  if (!hasSession && !isPublicPath(pathname)) {
    url.pathname = LOGIN_PATH;
    url.search = "";
    // Simpan tujuan awal (termasuk query) agar setelah login kembali ke sana.
    url.searchParams.set("redirectedFrom", pathname + request.nextUrl.search);
  } else if (hasSession && pathname === LOGIN_PATH) {
    url.pathname = "/dashboard";
    url.search = "";
  } else {
    return supabaseResponse;
  }

  const response = NextResponse.redirect(url, { headers: authHeaders });
  for (const cookie of supabaseResponse.cookies.getAll()) response.cookies.set(cookie);
  return response;
}
