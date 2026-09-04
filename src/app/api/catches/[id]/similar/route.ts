import { NextRequest } from "next/server";
import { canViewCatch, getCatch, listCatches } from "@/lib/db/catches";
import { findSimilar } from "@/lib/similar";
import { requireUnlockedViewer } from "@/lib/journal-access";
import { includeSharedFrom, jsonWithViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const access = await requireUnlockedViewer(request);
  if (!access.ok) return access.response;
  const { viewerId } = access;
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
