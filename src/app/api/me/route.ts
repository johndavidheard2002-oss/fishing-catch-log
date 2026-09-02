import { NextRequest } from "next/server";
import { getAngler, listAnglers, renameAngler } from "@/lib/db/anglers";
import { jsonWithViewer, viewerIdFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewerId = viewerIdFromRequest(request);
  const me = getAngler(viewerId);
  const profiles = listAnglers();
  return jsonWithViewer({ me, profiles }, viewerId);
}

export async function PATCH(request: NextRequest) {
  const viewerId = viewerIdFromRequest(request);
  const body = (await request.json()) as { name?: string; switchTo?: string };
  if (body.switchTo) {
    const next = getAngler(body.switchTo);
    if (!next) return jsonWithViewer({ error: "Profile not found" }, viewerId, { status: 404 });
    return jsonWithViewer({ me: next, profiles: listAnglers() }, next.id);
  }
  if (body.name != null) {
    const me = renameAngler(viewerId, body.name);
    return jsonWithViewer({ me, profiles: listAnglers() }, viewerId);
  }
  return jsonWithViewer({ me: getAngler(viewerId), profiles: listAnglers() }, viewerId);
}
