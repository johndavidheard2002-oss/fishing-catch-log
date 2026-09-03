import { NextResponse, type NextRequest } from "next/server";
import { ANGLER_COOKIE, SESSION_COOKIE, VIEWER_COOKIE } from "@/lib/viewer-cookie";

function withAnglerCookie(header: string | null, id: string): string {
  const parts = (header ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith(`${ANGLER_COOKIE}=`));
  parts.push(`${ANGLER_COOKIE}=${id}`);
  return parts.join("; ");
}

/** Mint a journal cookie before SSR/API so one browser does not create several anglers. */
export function middleware(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE)?.value?.trim();
  const existing = request.cookies.get(ANGLER_COOKIE)?.value?.trim();
  if (existing || session) return NextResponse.next();

  const id = crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set("cookie", withAnglerCookie(request.headers.get("cookie"), id));
  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(ANGLER_COOKIE, id, VIEWER_COOKIE);
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|brand/|splash/|seed/|favicon.ico|sw\\.js|icon-|apple-icon|manifest).*)",
  ],
};
