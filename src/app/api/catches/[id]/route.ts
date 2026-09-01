import { NextRequest } from "next/server";
import { deleteCatch, getCatch, updateCatch } from "@/lib/db/catches";
import { catchInputFromUnknown } from "@/lib/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const record = getCatch(id);
  if (!record) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ catch: record });
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await request.json()) as Record<string, unknown>;
  const input = catchInputFromUnknown(body);
  const record = updateCatch(id, input);
  if (!record) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ catch: record });
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const ok = deleteCatch(id);
  if (!ok) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
