import { NextRequest, NextResponse } from "next/server";
import { publicAngler, registerJournal } from "@/lib/auth";
import { jsonWithViewer, viewerFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { id: viewerId } = await viewerFromRequest(request);
  const body = (await request.json()) as {
    name?: string;
    email?: string;
    password?: string;
    confirm?: string;
  };
  const result = await registerJournal({
    viewerId,
    name: body.name ?? "",
    email: body.email ?? "",
    password: typeof body.password === "string" ? body.password : "",
    confirm: typeof body.confirm === "string" ? body.confirm : "",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return jsonWithViewer({ me: publicAngler(result.angler), signedIn: true }, result.angler.id, undefined, true);
}
