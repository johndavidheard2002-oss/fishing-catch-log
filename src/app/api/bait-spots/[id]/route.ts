import { NextRequest } from "next/server";
import { canViewBaitSpot, deleteBaitSpot, getBaitSpot, updateBaitSpot } from "@/lib/db/bait";
import { parseBaitSpotInput } from "@/lib/bait";
import { jsonWithViewer, viewerIdFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const viewerId = viewerIdFromRequest(request);
  const { id } = await ctx.params;
  const record = getBaitSpot(id);
  if (!record || !canViewBaitSpot(record, viewerId)) {
    return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  }
  return jsonWithViewer({ spot: record }, viewerId);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const viewerId = viewerIdFromRequest(request);
  const { id } = await ctx.params;
  const existing = getBaitSpot(id);
  if (!existing || existing.anglerId !== viewerId) {
    return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseBaitSpotInput({
    ...body,
    baitTypes: body.baitTypes ?? existing.baitTypes,
    loggedAt: body.loggedAt ?? existing.loggedAt,
  });
  if (!input) {
    return jsonWithViewer(
      { error: "Add at least one bait type — shrimp, mullet, crabs, or whatever you scooped." },
      viewerId,
      { status: 400 },
    );
  }
  const spot = updateBaitSpot(id, { ...input, anglerId: existing.anglerId });
  if (!spot) return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  return jsonWithViewer({ spot }, viewerId);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const viewerId = viewerIdFromRequest(request);
  const { id } = await ctx.params;
  const existing = getBaitSpot(id);
  if (!existing || existing.anglerId !== viewerId) {
    return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  }
  const ok = deleteBaitSpot(id);
  if (!ok) return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  return jsonWithViewer({ ok: true }, viewerId);
}
