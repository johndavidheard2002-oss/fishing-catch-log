import { NextRequest } from "next/server";
import { createBaitSpot, listBaitSpots } from "@/lib/db/bait";
import { groupBaitSpots, parseBaitSpotInput } from "@/lib/bait";
import { includeSharedFrom, jsonWithViewer, viewerIdFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewerId = viewerIdFromRequest(request);
  const spots = listBaitSpots({
    viewerId,
    includeShared: includeSharedFrom(request),
  });
  const grouped = groupBaitSpots(spots);
  return jsonWithViewer({ spots, groups: grouped }, viewerId);
}

export async function POST(request: NextRequest) {
  const viewerId = viewerIdFromRequest(request);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseBaitSpotInput(body);
  if (!input) {
    return jsonWithViewer(
      { error: "Add at least one bait type — shrimp, mullet, crabs, or whatever you scooped." },
      viewerId,
      { status: 400 },
    );
  }
  const spot = createBaitSpot({ ...input, anglerId: viewerId });
  return jsonWithViewer({ spot }, viewerId, { status: 201 });
}
