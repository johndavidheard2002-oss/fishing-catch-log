import { NextRequest } from "next/server";
import { canViewBaitSpot, deleteBaitSpot, getBaitSpot, updateBaitSpot } from "@/lib/db/bait";
import { parseBaitSpotInput } from "@/lib/bait";
import { jsonWithViewer, requireViewerId, signInRequired } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const viewerId = await requireViewerId(request);
  if (!viewerId) return signInRequired();
  const { id } = await ctx.params;
  const record = await getBaitSpot(id);
  if (!record || !(await canViewBaitSpot(record, viewerId))) {
    return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  }
  return jsonWithViewer({ spot: record }, viewerId);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const viewerId = await requireViewerId(request);
  if (!viewerId) return signInRequired();
  const { id } = await ctx.params;
  const existing = await getBaitSpot(id);
  if (!existing || existing.anglerId !== viewerId) {
    return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseBaitSpotInput({
    ...body,
    baitTypes: body.baitTypes ?? existing.baitTypes,
    loggedAt: body.loggedAt ?? existing.loggedAt,
    latitude: body.latitude ?? existing.latitude,
    longitude: body.longitude ?? existing.longitude,
    placeName: body.placeName ?? existing.placeName,
  });
  if (!input) {
    return jsonWithViewer(
      { error: "Add a bait type and tap the map to pin the hole." },
      viewerId,
      { status: 400 },
    );
  }
  const spot = await updateBaitSpot(id, { ...input, anglerId: existing.anglerId });
  if (!spot) return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  return jsonWithViewer({ spot }, viewerId);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const viewerId = await requireViewerId(request);
  if (!viewerId) return signInRequired();
  const { id } = await ctx.params;
  const existing = await getBaitSpot(id);
  if (!existing || existing.anglerId !== viewerId) {
    return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  }
  const ok = await deleteBaitSpot(id);
  if (!ok) return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  return jsonWithViewer({ ok: true }, viewerId);
}
