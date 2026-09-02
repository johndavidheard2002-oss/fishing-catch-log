import { NextRequest } from "next/server";
import { listBaitSpots } from "@/lib/db/bait";
import { listCatches } from "@/lib/db/catches";
import { buildPlan, parsePlanDate } from "@/lib/plan";
import { includeSharedFrom, jsonWithViewer, viewerIdFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewerId = viewerIdFromRequest(request);
  const includeShared = includeSharedFrom(request);
  const date = parsePlanDate(request.nextUrl.searchParams.get("date"));
  if (!date) {
    return jsonWithViewer(
      {
        days: 1,
        generatedAt: new Date().toISOString(),
        weatherSource: "demo",
        tideSource: "demo",
        note: "Pick a day to plan.",
        suggestions: [],
        baitSuggestions: [],
      },
      viewerId,
    );
  }
  const plan = await buildPlan(
    listCatches({ viewerId, includeShared }),
    1,
    listBaitSpots({ viewerId, includeShared }),
    date,
  );
  return jsonWithViewer(plan, viewerId);
}
