import { NextRequest, NextResponse } from "next/server";
import { createAngler, getAngler } from "./db/anglers";
import { ANGLER_COOKIE, VIEWER_COOKIE } from "./viewer-cookie";

export { ANGLER_COOKIE, VIEWER_COOKIE };

/** Journal owner for this browser. Unknown visitors get a new angler — never the first/default row. */
export async function resolveViewerId(cookieValue?: string | null): Promise<string> {
  const fromCookie = cookieValue?.trim();
  if (fromCookie && (await getAngler(fromCookie))) return fromCookie;
  if (fromCookie) {
    const claimed = await createAngler("You", fromCookie);
    if (claimed.id === fromCookie) return claimed.id;
    const raced = await getAngler(fromCookie);
    if (raced) return raced.id;
  }
  return (await createAngler("You")).id;
}

export async function viewerIdFromRequest(request: NextRequest): Promise<string> {
  return resolveViewerId(request.cookies.get(ANGLER_COOKIE)?.value);
}

export function applyViewerCookie(res: NextResponse, viewerId: string): NextResponse {
  res.cookies.set(ANGLER_COOKIE, viewerId, VIEWER_COOKIE);
  return res;
}

export function jsonWithViewer(
  data: unknown,
  viewerId: string,
  init?: ResponseInit,
): NextResponse {
  const res = NextResponse.json(data, init);
  return applyViewerCookie(res, viewerId);
}

export function includeSharedFrom(request: NextRequest): boolean {
  const raw = request.nextUrl.searchParams.get("includeShared");
  return raw === "1" || raw === "true";
}
