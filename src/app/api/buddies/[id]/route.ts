import { NextRequest } from "next/server";
import { listBuddies, unlinkAnglers } from "@/lib/db/anglers";
import { jsonWithViewer, viewerIdFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const viewerId = await viewerIdFromRequest(request);
  const { id } = await ctx.params;
  await unlinkAnglers(viewerId, id);
  return jsonWithViewer({ buddies: await listBuddies(viewerId) }, viewerId);
}
