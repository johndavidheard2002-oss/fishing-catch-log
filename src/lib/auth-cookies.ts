import { NextResponse } from "next/server";
import { SESSION_COOKIE_OPTS } from "./session-token";
import {
  ANGLER_COOKIE,
  LEGACY_SESSION_COOKIE,
  SESSION_COOKIE,
  VIEWER_COOKIE,
} from "./viewer-cookie";

export { ANGLER_COOKIE, LEGACY_SESSION_COOKIE, SESSION_COOKIE, VIEWER_COOKIE };

/** Drop leftover anonymous and pre-rotation session cookies on this origin. */
export function expireStaleAuthCookies<T extends NextResponse>(res: T): T {
  res.cookies.set(ANGLER_COOKIE, "", { ...VIEWER_COOKIE, maxAge: 0 });
  res.cookies.set(LEGACY_SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTS, maxAge: 0 });
  return res;
}

export function clearAuthCookies(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTS, maxAge: 0 });
  return expireStaleAuthCookies(res);
}

export function applySessionCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTS);
  return expireStaleAuthCookies(res);
}
