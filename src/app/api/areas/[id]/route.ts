import { NextRequest } from "next/server";
import { deleteNamedArea, getNamedArea, updateNamedArea } from "@/lib/db/areas";
import { parseNamedAreaInput } from "@/lib/areas";
import { jsonWithViewer, viewerIdFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const viewerId = await viewerIdFromRequest(request);
  const { id } = await ctx.params;
  const existing = await getNamedArea(id);
  if (!existing || existing.anglerId !== viewerId) {
    return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseNamedAreaInput({ ...body, name: body.name ?? existing.name });
  if (!input) {
    return jsonWithViewer({ error: "Name this area so you can pick it next time." }, viewerId, {
      status: 400,
    });
  }
  const area = await updateNamedArea(id, viewerId, input);
  if (!area) return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  return jsonWithViewer({ area }, viewerId);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const viewerId = await viewerIdFromRequest(request);
  const { id } = await ctx.params;
  const ok = await deleteNamedArea(id, viewerId);
  if (!ok) return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  return jsonWithViewer({ ok: true }, viewerId);
}
