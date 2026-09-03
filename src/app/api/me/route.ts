import { NextRequest } from "next/server";
import { getAngler, listHouseholdProfiles, renameAngler } from "@/lib/db/anglers";
import { jsonWithViewer, viewerFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { id: viewerId, signedIn } = await viewerFromRequest(request);
  const me = await getAngler(viewerId, { includeEmail: true });
  const profiles = signedIn ? (me ? [me] : []) : await listHouseholdProfiles(viewerId);
  return jsonWithViewer({ me, profiles, signedIn }, viewerId, undefined, signedIn);
}

export async function PATCH(request: NextRequest) {
  const { id: viewerId, signedIn } = await viewerFromRequest(request);
  const body = (await request.json()) as { name?: string; switchTo?: string };
  if (body.switchTo) {
    if (signedIn) {
      return jsonWithViewer({ error: "Sign out before switching journals." }, viewerId, { status: 403 }, true);
    }
    const household = await listHouseholdProfiles(viewerId);
    const next = household.find((profile) => profile.id === body.switchTo);
    if (!next) return jsonWithViewer({ error: "Profile not found" }, viewerId, { status: 404 });
    return jsonWithViewer({ me: next, profiles: await listHouseholdProfiles(next.id), signedIn: false }, next.id);
  }
  if (body.name != null) {
    const me = await renameAngler(viewerId, body.name);
    const profiles = signedIn ? (me ? [me] : []) : await listHouseholdProfiles(viewerId);
    return jsonWithViewer({ me, profiles, signedIn }, viewerId, undefined, signedIn);
  }
  const me = await getAngler(viewerId, { includeEmail: true });
  const profiles = signedIn ? (me ? [me] : []) : await listHouseholdProfiles(viewerId);
  return jsonWithViewer({ me, profiles, signedIn }, viewerId, undefined, signedIn);
}
