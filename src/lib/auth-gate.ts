/** Paths that do not need a signed-in session cookie. */

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/signin" || pathname.startsWith("/signin/")) return true;
  if (
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/register" ||
    pathname === "/api/auth/logout"
  ) {
    return true;
  }
  if (pathname === "/api/me" || pathname === "/api/health" || pathname === "/api/status") return true;
  return false;
}

export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export type AuthGate =
  | { action: "next" }
  | { action: "redirect"; to: string }
  | { action: "unauthorized" };

/** Cookie presence only — Node validates the HMAC when the request hits a route. */
export function authGate(args: { pathname: string; hasSession: boolean }): AuthGate {
  if (args.hasSession) {
    if (args.pathname === "/signin" || args.pathname.startsWith("/signin/")) {
      return { action: "redirect", to: "/" };
    }
    return { action: "next" };
  }
  if (isPublicPath(args.pathname)) return { action: "next" };
  if (isApiPath(args.pathname)) return { action: "unauthorized" };
  return { action: "redirect", to: "/signin" };
}
