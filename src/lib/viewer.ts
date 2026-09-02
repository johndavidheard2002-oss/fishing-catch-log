import { NextRequest, NextResponse } from "next/server";
import { ensureDefaultAngler, getAngler } from "./db/anglers";

export const ANGLER_COOKIE = "cast-log-angler";

export function viewerIdFromRequest(request: NextRequest): string {
  const fromCookie = request.cookies.get(ANGLER_COOKIE)?.value;
  if (fromCookie && getAngler(fromCookie)) return fromCookie;
  return ensureDefaultAngler().id;
}

export function jsonWithViewer(
  data: unknown,
  viewerId: string,
  init?: ResponseInit,
): NextResponse {
  const res = NextResponse.json(data, init);
  res.cookies.set(ANGLER_COOKIE, viewerId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}

export function includeSharedFrom(request: NextRequest): boolean {
  const raw = request.nextUrl.searchParams.get("includeShared");
  return raw === "1" || raw === "true";
}
