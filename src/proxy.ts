import { NextResponse, type NextRequest } from "next/server";
import { authGate } from "@/lib/auth-gate";
import { readSession } from "@/lib/session-token";
import { SESSION_COOKIE } from "@/lib/viewer-cookie";

/** Require a valid session for the journal. Do not mint anonymous angler cookies. */
export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value?.trim();
  const decision = authGate({
    pathname: request.nextUrl.pathname,
    hasSession: Boolean(readSession(token)),
  });
  if (decision.action === "next") return NextResponse.next();
  if (decision.action === "unauthorized") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  return NextResponse.redirect(new URL(decision.to, request.url));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|brand/|splash/|seed/|favicon.ico|sw\\.js|icon-|apple-icon|manifest).*)",
  ],
};
