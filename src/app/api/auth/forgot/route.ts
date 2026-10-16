import { after, NextRequest, NextResponse } from "next/server";
import { requestIp } from "@/lib/auth";
import { FORGOT_GENERIC_MESSAGE, requestPasswordReset, resetLinkOrigin } from "@/lib/password-reset";
import { expireStaleAuthCookies } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  try {
    const result = await requestPasswordReset({
      email: typeof body.email === "string" ? body.email : "",
      ip: requestIp(request),
      origin: resetLinkOrigin({ requestOrigin: request.nextUrl.origin }),
    });
    if (!result.ok) {
      return expireStaleAuthCookies(NextResponse.json({ error: result.error }, { status: result.status }));
    }
    // Send after the response so a real account does not answer slower than an unknown email.
    after(() => result.send);
    return expireStaleAuthCookies(NextResponse.json({ ok: true, message: result.message }));
  } catch (err) {
    console.error("[password-reset] forgot request failed:", err instanceof Error ? err.message : err);
    return expireStaleAuthCookies(NextResponse.json({ ok: true, message: FORGOT_GENERIC_MESSAGE }));
  }
}
