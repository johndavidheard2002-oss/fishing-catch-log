import { NextRequest } from "next/server";
import { canViewCatch, deleteCatch, getCatch, updateCatch } from "@/lib/db/catches";
import { catchInputFromUnknown } from "@/lib/parse";
import { jsonWithViewer, viewerIdFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const viewerId = viewerIdFromRequest(request);
  const { id } = await ctx.params;
  const record = getCatch(id);
  if (!record || !canViewCatch(record, viewerId)) {
    return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  }
  return jsonWithViewer({ catch: record }, viewerId);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const viewerId = viewerIdFromRequest(request);
  const { id } = await ctx.params;
  const existing = getCatch(id);
  if (!existing || existing.anglerId !== viewerId) {
    return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  }
  const body = (await request.json()) as Record<string, unknown>;
  const input = catchInputFromUnknown(body);
  const record = updateCatch(id, { ...input, anglerId: existing.anglerId });
  if (!record) return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  return jsonWithViewer({ catch: record }, viewerId);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const viewerId = viewerIdFromRequest(request);
  const { id } = await ctx.params;
  const existing = getCatch(id);
  if (!existing || existing.anglerId !== viewerId) {
    return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  }
  const ok = deleteCatch(id);
  if (!ok) return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  return jsonWithViewer({ ok: true }, viewerId);
}
