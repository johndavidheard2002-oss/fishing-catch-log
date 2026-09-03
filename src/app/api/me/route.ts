import { NextRequest, NextResponse } from "next/server";
import { getAngler, renameAngler } from "@/lib/db/anglers";
import { clearAuthCookies, jsonWithViewer, requireViewerId, signInRequired, viewerFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { id: viewerId, signedIn } = await viewerFromRequest(request);
  if (!signedIn) {
    return clearAuthCookies(
      NextResponse.json({
        me: null,
        profiles: [],
        signedIn: false,
        claimable: false,
      }),
    );
  }
  const me = await getAngler(viewerId, { includeEmail: true });
  return jsonWithViewer({ me, profiles: me ? [me] : [], signedIn: true }, viewerId, undefined, true);
}

export async function PATCH(request: NextRequest) {
  const viewerId = await requireViewerId(request);
  if (!viewerId) return signInRequired();
  const body = (await request.json()) as { name?: string; switchTo?: string };
  if (body.switchTo) {
    return jsonWithViewer({ error: "Sign out before switching journals." }, viewerId, { status: 403 }, true);
  }
  if (body.name != null) {
    const me = await renameAngler(viewerId, body.name);
    return jsonWithViewer({ me, profiles: me ? [me] : [], signedIn: true }, viewerId, undefined, true);
  }
  const me = await getAngler(viewerId, { includeEmail: true });
  return jsonWithViewer({ me, profiles: me ? [me] : [], signedIn: true }, viewerId, undefined, true);
}
