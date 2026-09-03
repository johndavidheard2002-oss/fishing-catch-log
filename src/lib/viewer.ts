import { NextRequest, NextResponse } from "next/server";
import { getAngler, seedDefaultAngler } from "./db/anglers";

export const ANGLER_COOKIE = "cast-log-angler";

export async function viewerIdFromRequest(request: NextRequest): Promise<string> {
  const fromCookie = request.cookies.get(ANGLER_COOKIE)?.value;
  if (fromCookie && (await getAngler(fromCookie))) return fromCookie;
  return (await seedDefaultAngler()).id;
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
