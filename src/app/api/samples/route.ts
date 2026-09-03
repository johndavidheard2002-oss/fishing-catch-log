import { NextRequest } from "next/server";
import { ensureDb } from "@/lib/db";
import { countSampleCatches, loadSampleCatches, removeSampleCatches } from "@/lib/db/seed";
import { jsonWithViewer, viewerIdFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewerId = await viewerIdFromRequest(request);
  const db = await ensureDb();
  const count = await countSampleCatches(db);
  return jsonWithViewer({ loaded: count > 0, count }, viewerId);
}

export async function POST(request: NextRequest) {
  const viewerId = await viewerIdFromRequest(request);
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  const db = await ensureDb();
  if (body.action === "remove") {
    const removed = await removeSampleCatches(db);
    return jsonWithViewer({ loaded: false, count: 0, removed }, viewerId);
  }
  const result = await loadSampleCatches(db, viewerId);
  return jsonWithViewer(
    { loaded: true, count: await countSampleCatches(db), inserted: result.inserted },
    viewerId,
  );
}
