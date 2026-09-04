import { NextRequest } from "next/server";
import { canViewCatch, deleteCatch, getCatch, updateCatch } from "@/lib/db/catches";
import { catchInputFromUnknown } from "@/lib/parse";
import { requireUnlockedViewer } from "@/lib/journal-access";
import { jsonWithViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const access = await requireUnlockedViewer(request);
  if (!access.ok) return access.response;
  const { viewerId } = access;
  const { id } = await ctx.params;
  const record = await getCatch(id);
  if (!record || !(await canViewCatch(record, viewerId))) {
    return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  }
  return jsonWithViewer({ catch: record }, viewerId);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const access = await requireUnlockedViewer(request);
  if (!access.ok) return access.response;
  const { viewerId } = access;
  const { id } = await ctx.params;
  const existing = await getCatch(id);
  if (!existing || existing.anglerId !== viewerId) {
    return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  }
  const body = (await request.json()) as Record<string, unknown>;
  const input = catchInputFromUnknown(body);
  const record = await updateCatch(id, { ...input, anglerId: existing.anglerId });
  if (!record) return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  return jsonWithViewer({ catch: record }, viewerId);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const access = await requireUnlockedViewer(request);
  if (!access.ok) return access.response;
  const { viewerId } = access;
  const { id } = await ctx.params;
  const existing = await getCatch(id);
  if (!existing || existing.anglerId !== viewerId) {
    return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  }
  const ok = await deleteCatch(id);
  if (!ok) return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  return jsonWithViewer({ ok: true }, viewerId);
}
