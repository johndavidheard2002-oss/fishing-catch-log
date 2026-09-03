import { NextRequest } from "next/server";
import { createBaitSpot, listBaitSpots } from "@/lib/db/bait";
import { groupBaitSpots, parseBaitSpotInput } from "@/lib/bait";
import { includeSharedFrom, jsonWithViewer, requireViewerId, signInRequired } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewerId = await requireViewerId(request);
  if (!viewerId) return signInRequired();
  const spots = await listBaitSpots({
    viewerId,
    includeShared: includeSharedFrom(request),
  });
  const grouped = groupBaitSpots(spots);
  return jsonWithViewer({ spots, groups: grouped }, viewerId);
}

export async function POST(request: NextRequest) {
  const viewerId = await requireViewerId(request);
  if (!viewerId) return signInRequired();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseBaitSpotInput(body);
  if (!input) {
    return jsonWithViewer(
      { error: "Add a bait type and tap the map to pin the hole." },
      viewerId,
      { status: 400 },
    );
  }
  const spot = await createBaitSpot({ ...input, anglerId: viewerId });
  return jsonWithViewer({ spot }, viewerId, { status: 201 });
}
