import { NextRequest } from "next/server";
import { listCatches } from "@/lib/db/catches";
import { groupSpots } from "@/lib/filters";
import { requireUnlockedViewer } from "@/lib/journal-access";
import { includeSharedFrom, jsonWithViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await requireUnlockedViewer(request);
  if (!access.ok) return access.response;
  const { viewerId } = access;
  const spots = groupSpots(
    await listCatches({ viewerId, includeShared: includeSharedFrom(request) }),
  );
  return jsonWithViewer({ spots }, viewerId);
}
