import { NextRequest } from "next/server";
import { listCatches } from "@/lib/db/catches";
import { groupSpots } from "@/lib/filters";
import { includeSharedFrom, jsonWithViewer, viewerIdFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewerId = await viewerIdFromRequest(request);
  const spots = groupSpots(
    await listCatches({ viewerId, includeShared: includeSharedFrom(request) }),
  );
  return jsonWithViewer({ spots }, viewerId);
}
