import { NextRequest, NextResponse } from "next/server";
import { readSession, signSession } from "./auth";
import {
  ANGLER_COOKIE,
  SESSION_COOKIE,
  VIEWER_COOKIE,
  applySessionCookie as writeSessionCookie,
  clearAuthCookies,
  expireStaleAuthCookies,
} from "./auth-cookies";
import { getAngler } from "./db/anglers";

export { ANGLER_COOKIE, SESSION_COOKIE, VIEWER_COOKIE, clearAuthCookies, expireStaleAuthCookies };

export const SIGN_IN_REQUIRED = "Sign in required.";

/** Leftover anonymous cookies never open a journal. */
export async function resolveViewerId(_cookieValue?: string | null): Promise<string> {
  return "";
}

export async function resolveViewerFromCookies(
  _anonCookie?: string | null,
  sessionCookie?: string | null,
): Promise<{ id: string; signedIn: boolean }> {
  const sessionId = readSession(sessionCookie);
  if (sessionId) {
    const angler = await getAngler(sessionId);
    if (angler?.claimed) return { id: sessionId, signedIn: true };
  }
  return { id: "", signedIn: false };
}

export async function viewerFromRequest(
  request: NextRequest,
): Promise<{ id: string; signedIn: boolean }> {
  return resolveViewerFromCookies(null, request.cookies.get(SESSION_COOKIE)?.value);
}

export function signInRequired(): NextResponse {
  return clearAuthCookies(NextResponse.json({ error: SIGN_IN_REQUIRED }, { status: 401 }));
}

export async function requireViewerId(request: NextRequest): Promise<string | null> {
  const { id, signedIn } = await viewerFromRequest(request);
  return signedIn && id ? id : null;
}

/** Signed-in journal id, or empty when the request has no valid session. */
export async function viewerIdFromRequest(request: NextRequest): Promise<string> {
  return (await requireViewerId(request)) ?? "";
}

export function applySessionCookie(res: NextResponse, viewerId: string): NextResponse {
  return writeSessionCookie(res, signSession(viewerId));
}

export function jsonWithViewer(
  data: unknown,
  viewerId: string,
  init?: ResponseInit,
  signedIn = false,
): NextResponse {
  const res = NextResponse.json(data, init);
  if (signedIn && viewerId) return applySessionCookie(res, viewerId);
  return expireStaleAuthCookies(res);
}

export function includeSharedFrom(request: NextRequest): boolean {
  const raw = request.nextUrl.searchParams.get("includeShared");
  return raw === "1" || raw === "true";
}
