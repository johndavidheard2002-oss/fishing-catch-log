import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { countSampleCatches, loadSampleCatches, removeSampleCatches } from "@/lib/db/seed";
import { jsonWithViewer, viewerIdFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewerId = viewerIdFromRequest(request);
  const db = getDb();
  const count = countSampleCatches(db);
  return jsonWithViewer({ loaded: count > 0, count }, viewerId);
}

export async function POST(request: NextRequest) {
  const viewerId = viewerIdFromRequest(request);
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  const db = getDb();
  if (body.action === "remove") {
    const removed = removeSampleCatches(db);
    return jsonWithViewer({ loaded: false, count: 0, removed }, viewerId);
  }
  const result = loadSampleCatches(db, viewerId);
  return jsonWithViewer(
    { loaded: true, count: countSampleCatches(db), inserted: result.inserted },
    viewerId,
  );
}
