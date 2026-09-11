import { NextRequest } from "next/server";
import { isCalendarDayKey, setSharedForCatchIds, setSharedForDay } from "@/lib/db/catches";
import { setSharedForBaitIds } from "@/lib/db/bait";
import { setSharedForPlanDay } from "@/lib/db/notes";
import { requireUnlockedViewer } from "@/lib/journal-access";
import { jsonWithViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function idList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && id.trim().length > 0))];
}

export async function POST(request: NextRequest) {
  const access = await requireUnlockedViewer(request);
  if (!access.ok) return access.response;
  const { viewerId } = access;
  const body = (await request.json().catch(() => ({}))) as {
    day?: unknown;
    planDay?: unknown;
    shared?: unknown;
    catchIds?: unknown;
    baitSpotIds?: unknown;
    buddyIds?: unknown;
  };
  const shared = body.shared === true;
  const day = typeof body.day === "string" ? body.day : "";
  const planDay = typeof body.planDay === "string" ? body.planDay : "";
  const catchIds = idList(body.catchIds);
  const baitSpotIds = idList(body.baitSpotIds);
  const buddyIds = Array.isArray(body.buddyIds) ? idList(body.buddyIds) : undefined;

  if (planDay) {
    if (!isCalendarDayKey(planDay)) {
      return jsonWithViewer({ error: "Pick a calendar day." }, viewerId, { status: 400 });
    }
    const result = await setSharedForPlanDay({ anglerId: viewerId, day: planDay, shared, buddyIds });
    return jsonWithViewer({ ok: true, planDay, shared, ...result }, viewerId);
  }

  if (day) {
    if (!isCalendarDayKey(day)) {
      return jsonWithViewer({ error: "Pick a calendar day." }, viewerId, { status: 400 });
    }
    const result = await setSharedForDay({ anglerId: viewerId, day, shared, buddyIds });
    return jsonWithViewer({ ok: true, day, shared, ...result }, viewerId);
  }

  if (!catchIds.length && !baitSpotIds.length) {
    return jsonWithViewer({ error: "Pick spots to share." }, viewerId, { status: 400 });
  }

  const catches = await setSharedForCatchIds({ anglerId: viewerId, ids: catchIds, shared, buddyIds });
  const bait = await setSharedForBaitIds({ anglerId: viewerId, ids: baitSpotIds, shared, buddyIds });
  return jsonWithViewer(
    { ok: true, shared, updated: catches.updated + bait.updated, catchUpdated: catches.updated, baitUpdated: bait.updated },
    viewerId,
  );
}
