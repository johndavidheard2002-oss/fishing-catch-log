import { NextRequest } from "next/server";
import { listCatches } from "@/lib/db/catches";
import { groupSpots } from "@/lib/filters";
import { includeSharedFrom, jsonWithViewer, requireViewerId, signInRequired } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewerId = await requireViewerId(request);
  if (!viewerId) return signInRequired();
  const spots = groupSpots(
    await listCatches({ viewerId, includeShared: includeSharedFrom(request) }),
  );
  return jsonWithViewer({ spots }, viewerId);
}
