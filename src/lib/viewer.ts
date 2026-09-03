import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_COOKIE_OPTS, readSession, signSession } from "./auth";
import { createAngler, getAngler } from "./db/anglers";
import { ANGLER_COOKIE, VIEWER_COOKIE } from "./viewer-cookie";

export { ANGLER_COOKIE, SESSION_COOKIE, VIEWER_COOKIE };

/** Anonymous journal for this browser. Claimed accounts are not reused without a session. */
export async function resolveViewerId(cookieValue?: string | null): Promise<string> {
  const fromCookie = cookieValue?.trim();
  if (fromCookie) {
    const existing = await getAngler(fromCookie);
    if (existing && !existing.claimed) return existing.id;
    if (!existing) {
      const created = await createAngler("You", fromCookie);
      if (created.id === fromCookie && !created.claimed) return created.id;
    }
  }
  return (await createAngler("You")).id;
}

export async function resolveViewerFromCookies(
  anonCookie?: string | null,
  sessionCookie?: string | null,
): Promise<{ id: string; signedIn: boolean }> {
  const sessionId = readSession(sessionCookie);
  if (sessionId && (await getAngler(sessionId))) {
    return { id: sessionId, signedIn: true };
  }
  return { id: await resolveViewerId(anonCookie), signedIn: false };
}

export async function viewerFromRequest(
  request: NextRequest,
): Promise<{ id: string; signedIn: boolean }> {
  return resolveViewerFromCookies(
    request.cookies.get(ANGLER_COOKIE)?.value,
    request.cookies.get(SESSION_COOKIE)?.value,
  );
}

export async function viewerIdFromRequest(request: NextRequest): Promise<string> {
  return (await viewerFromRequest(request)).id;
}

export function applyViewerCookie(res: NextResponse, viewerId: string): NextResponse {
  res.cookies.set(ANGLER_COOKIE, viewerId, VIEWER_COOKIE);
  return res;
}

export function applySessionCookie(res: NextResponse, viewerId: string): NextResponse {
  res.cookies.set(SESSION_COOKIE, signSession(viewerId), SESSION_COOKIE_OPTS);
  applyViewerCookie(res, viewerId);
  return res;
}

export function clearAuthCookies(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTS, maxAge: 0 });
  res.cookies.set(ANGLER_COOKIE, "", { ...VIEWER_COOKIE, maxAge: 0 });
  return res;
}

export function jsonWithViewer(
  data: unknown,
  viewerId: string,
  init?: ResponseInit,
  signedIn = false,
): NextResponse {
  const res = NextResponse.json(data, init);
  if (signedIn) return applySessionCookie(res, viewerId);
  return applyViewerCookie(res, viewerId);
}

export function includeSharedFrom(request: NextRequest): boolean {
  const raw = request.nextUrl.searchParams.get("includeShared");
  return raw === "1" || raw === "true";
}
