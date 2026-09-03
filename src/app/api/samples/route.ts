import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sample trips are not offered in production. Helpers in `@/lib/db/seed` stay for tests. */
export async function GET() {
  return NextResponse.json({ loaded: false, count: 0, available: false }, { status: 404 });
}

export async function POST() {
  return NextResponse.json({ error: "Sample catches are not available." }, { status: 404 });
}
