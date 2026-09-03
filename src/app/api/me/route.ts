import { NextRequest } from "next/server";
import { getAngler, listAnglers, renameAngler } from "@/lib/db/anglers";
import { jsonWithViewer, viewerIdFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewerId = await viewerIdFromRequest(request);
  const me = await getAngler(viewerId);
  const profiles = await listAnglers();
  return jsonWithViewer({ me, profiles }, viewerId);
}

export async function PATCH(request: NextRequest) {
  const viewerId = await viewerIdFromRequest(request);
  const body = (await request.json()) as { name?: string; switchTo?: string };
  if (body.switchTo) {
    const next = await getAngler(body.switchTo);
    if (!next) return jsonWithViewer({ error: "Profile not found" }, viewerId, { status: 404 });
    return jsonWithViewer({ me: next, profiles: await listAnglers() }, next.id);
  }
  if (body.name != null) {
    const me = await renameAngler(viewerId, body.name);
    return jsonWithViewer({ me, profiles: await listAnglers() }, viewerId);
  }
  return jsonWithViewer({ me: await getAngler(viewerId), profiles: await listAnglers() }, viewerId);
}
