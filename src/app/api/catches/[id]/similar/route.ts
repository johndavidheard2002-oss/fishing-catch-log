import { NextRequest } from "next/server";
import { canViewCatch, getCatch, listCatches } from "@/lib/db/catches";
import { findSimilar } from "@/lib/similar";
import { includeSharedFrom, jsonWithViewer, viewerIdFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const viewerId = viewerIdFromRequest(request);
  const { id } = await ctx.params;
  const record = getCatch(id);
  if (!record || !canViewCatch(record, viewerId)) {
    return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  }
  const matches = findSimilar(
    record,
    listCatches({ viewerId, includeShared: includeSharedFrom(request) }),
  );
  return jsonWithViewer({ target: record, matches }, viewerId);
}
