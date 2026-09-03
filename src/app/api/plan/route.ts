import { NextRequest } from "next/server";
import { listBaitSpots } from "@/lib/db/bait";
import { listCatches } from "@/lib/db/catches";
import { buildPlan, parsePlanDate } from "@/lib/plan";
import { includeSharedFrom, jsonWithViewer, requireViewerId, signInRequired } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewerId = await requireViewerId(request);
  if (!viewerId) return signInRequired();
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
    await listCatches({ viewerId, includeShared }),
    1,
    await listBaitSpots({ viewerId, includeShared }),
    date,
  );
  return jsonWithViewer(plan, viewerId);
}
