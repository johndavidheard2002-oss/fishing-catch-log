import { NextRequest } from "next/server";
import { isCalendarDayKey, setSharedForDay } from "@/lib/db/catches";
import { jsonWithViewer, viewerIdFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const viewerId = await viewerIdFromRequest(request);
  const body = (await request.json()) as { day?: unknown; shared?: unknown };
  const day = typeof body.day === "string" ? body.day : "";
  if (!isCalendarDayKey(day)) {
    return jsonWithViewer({ error: "Pick a calendar day." }, viewerId, { status: 400 });
  }
  const shared = body.shared === true;
  const result = await setSharedForDay({ anglerId: viewerId, day, shared });
  return jsonWithViewer({ ok: true, day, shared, ...result }, viewerId);
}
