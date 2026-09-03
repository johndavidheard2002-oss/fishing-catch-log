import { NextRequest } from "next/server";
import {
  createAngler,
  linkAnglers,
  linkByInviteCode,
  listBuddies,
} from "@/lib/db/anglers";
import { jsonWithViewer, requireViewerId, signInRequired } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewerId = await requireViewerId(request);
  if (!viewerId) return signInRequired();
  return jsonWithViewer({ buddies: await listBuddies(viewerId) }, viewerId);
}

export async function POST(request: NextRequest) {
  const viewerId = await requireViewerId(request);
  if (!viewerId) return signInRequired();
  const body = (await request.json()) as { code?: string; name?: string };
  try {
    if (body.code?.trim()) {
      const result = await linkByInviteCode(viewerId, body.code);
      if (!result.ok) {
        return jsonWithViewer({ error: result.error }, viewerId, { status: result.status });
      }
      return jsonWithViewer({ buddies: await listBuddies(viewerId), linked: result.linked }, viewerId);
    }
    if (body.name?.trim()) {
      const buddy = await createAngler(body.name);
      await linkAnglers(viewerId, buddy.id);
      return jsonWithViewer({ buddies: await listBuddies(viewerId), linked: buddy }, viewerId);
    }
    return jsonWithViewer({ error: "Enter an invite code or a friend name." }, viewerId, {
      status: 400,
    });
  } catch (err) {
    return jsonWithViewer(
      { error: err instanceof Error ? err.message : "Could not link friend" },
      viewerId,
      { status: 400 },
    );
  }
}
