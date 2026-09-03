import { NextRequest } from "next/server";
import { canViewCatch, getCatch, listCatches } from "@/lib/db/catches";
import { findSimilar } from "@/lib/similar";
import { includeSharedFrom, jsonWithViewer, requireViewerId, signInRequired } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const viewerId = await requireViewerId(request);
  if (!viewerId) return signInRequired();
  const { id } = await ctx.params;
  const record = await getCatch(id);
  if (!record || !(await canViewCatch(record, viewerId))) {
    return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  }
  const matches = findSimilar(
    record,
    await listCatches({ viewerId, includeShared: includeSharedFrom(request) }),
  );
  return jsonWithViewer({ target: record, matches }, viewerId);
}
