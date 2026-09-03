import { NextRequest } from "next/server";
import {
  createAngler,
  getAnglerByCode,
  linkAnglers,
  listBuddies,
} from "@/lib/db/anglers";
import { jsonWithViewer, viewerIdFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewerId = await viewerIdFromRequest(request);
  return jsonWithViewer({ buddies: await listBuddies(viewerId) }, viewerId);
}

export async function POST(request: NextRequest) {
  const viewerId = await viewerIdFromRequest(request);
  const body = (await request.json()) as { code?: string; name?: string };
  try {
    if (body.code?.trim()) {
      const other = await getAnglerByCode(body.code);
      if (!other) {
        return jsonWithViewer(
          { error: "That invite code was not found on this journal." },
          viewerId,
          { status: 404 },
        );
      }
      await linkAnglers(viewerId, other.id);
      return jsonWithViewer({ buddies: await listBuddies(viewerId), linked: other }, viewerId);
    }
    if (body.name?.trim()) {
      const buddy = await createAngler(body.name);
      await linkAnglers(viewerId, buddy.id);
      return jsonWithViewer({ buddies: await listBuddies(viewerId), linked: buddy }, viewerId);
    }
    return jsonWithViewer({ error: "Enter an invite code or a buddy name." }, viewerId, {
      status: 400,
    });
  } catch (err) {
    return jsonWithViewer(
      { error: err instanceof Error ? err.message : "Could not link buddy" },
      viewerId,
      { status: 400 },
    );
  }
}
