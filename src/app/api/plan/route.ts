import { NextRequest } from "next/server";
import { listCatches } from "@/lib/db/catches";
import { buildPlan } from "@/lib/plan";
import { includeSharedFrom, jsonWithViewer, viewerIdFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewerId = viewerIdFromRequest(request);
  const raw = Number(request.nextUrl.searchParams.get("days") ?? "5");
  const days = [3, 5, 7].includes(raw) ? raw : 5;
  const plan = await buildPlan(
    listCatches({ viewerId, includeShared: includeSharedFrom(request) }),
    days,
  );
  return jsonWithViewer(plan, viewerId);
}
