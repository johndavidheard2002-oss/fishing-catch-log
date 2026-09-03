import { NextRequest, NextResponse } from "next/server";
import { loginJournal, publicAngler, requestIp } from "@/lib/auth";
import { jsonWithViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { email?: string; password?: string };
  const result = await loginJournal({
    email: body.email ?? "",
    password: typeof body.password === "string" ? body.password : "",
    ip: requestIp(request),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return jsonWithViewer({ me: publicAngler(result.angler), signedIn: true }, result.angler.id, undefined, true);
}
