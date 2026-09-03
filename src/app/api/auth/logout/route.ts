import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return clearAuthCookies(NextResponse.json({ ok: true, signedIn: false }));
}
