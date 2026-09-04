import { NextRequest } from "next/server";
import { listBaitSpots } from "@/lib/db/bait";
import { listCatches } from "@/lib/db/catches";
import { buildPlan, parsePlanDate } from "@/lib/plan";
import { requireUnlockedViewer } from "@/lib/journal-access";
import { includeSharedFrom, jsonWithViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await requireUnlockedViewer(request);
  if (!access.ok) return access.response;
  const { viewerId } = access;
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
