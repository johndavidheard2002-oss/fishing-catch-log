import { NextRequest, NextResponse } from "next/server";
import { publicAngler, requestIp } from "@/lib/auth";
import { getAngler } from "@/lib/db/anglers";
import { resetPasswordWithToken, resetTokenUsable } from "@/lib/password-reset";
import { expireStaleAuthCookies, jsonWithViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lets the reset page say "expired" before the angler types a new password. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  return expireStaleAuthCookies(NextResponse.json({ valid: await resetTokenUsable(token) }));
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    token?: unknown;
    password?: unknown;
    confirm?: unknown;
  };
  const result = await resetPasswordWithToken({
    token: typeof body.token === "string" ? body.token : "",
    password: typeof body.password === "string" ? body.password : "",
    confirm: typeof body.confirm === "string" ? body.confirm : "",
    ip: requestIp(request),
  });
  if (!result.ok) {
    return expireStaleAuthCookies(NextResponse.json({ error: result.error }, { status: result.status }));
  }
  const angler = await getAngler(result.anglerId, { includeEmail: true });
  if (!angler) return expireStaleAuthCookies(NextResponse.json({ ok: true, signedIn: false }));
  // Fresh session for this browser; every older session was revoked by the reset.
  return jsonWithViewer({ ok: true, me: publicAngler(angler), signedIn: true }, angler.id, undefined, true);
}
