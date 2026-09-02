import { NextRequest } from "next/server";
import { listCatches } from "@/lib/db/catches";
import { groupSpots } from "@/lib/filters";
import { includeSharedFrom, jsonWithViewer, viewerIdFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewerId = viewerIdFromRequest(request);
  const spots = groupSpots(
    listCatches({ viewerId, includeShared: includeSharedFrom(request) }),
  );
  return jsonWithViewer({ spots }, viewerId);
}
