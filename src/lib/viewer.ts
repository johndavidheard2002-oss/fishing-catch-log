import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_COOKIE_OPTS, readSession, signSession } from "./auth";
import { getAngler } from "./db/anglers";
import { ANGLER_COOKIE, VIEWER_COOKIE } from "./viewer-cookie";

export { ANGLER_COOKIE, SESSION_COOKIE, VIEWER_COOKIE };

export const SIGN_IN_REQUIRED = "Sign in required.";

/** Existing unclaimed journal from a leftover cookie. Never mints a new anonymous angler. */
export async function resolveViewerId(cookieValue?: string | null): Promise<string> {
  const fromCookie = cookieValue?.trim();
  if (!fromCookie) return "";
  const existing = await getAngler(fromCookie);
  if (existing && !existing.claimed) return existing.id;
  return "";
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

export function signInRequired(): NextResponse {
  return NextResponse.json({ error: SIGN_IN_REQUIRED }, { status: 401 });
}

export async function requireViewerId(request: NextRequest): Promise<string | null> {
  const { id, signedIn } = await viewerFromRequest(request);
  return signedIn && id ? id : null;
}

/** Signed-in journal id, or empty when the request has no valid session. */
export async function viewerIdFromRequest(request: NextRequest): Promise<string> {
  return (await requireViewerId(request)) ?? "";
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
  if (signedIn && viewerId) return applySessionCookie(res, viewerId);
  return res;
}

export function includeSharedFrom(request: NextRequest): boolean {
  const raw = request.nextUrl.searchParams.get("includeShared");
  return raw === "1" || raw === "true";
}
