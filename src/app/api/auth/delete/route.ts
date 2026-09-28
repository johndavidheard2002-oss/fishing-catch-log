import { NextRequest, NextResponse } from "next/server";
import { deleteJournalAccount } from "@/lib/delete-account";
import { clearAuthCookies, jsonWithViewer, requireViewerId, signInRequired } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Permanent account deletion for App Store guideline 5.1.1(v).
 * Available to any signed-in journal — not gated on the free-release paywall.
 */
export async function POST(request: NextRequest) {
  const viewerId = await requireViewerId(request);
  if (!viewerId) return signInRequired();
  let body: { password?: unknown; confirm?: unknown } = {};
  try {
    body = (await request.json()) as { password?: unknown; confirm?: unknown };
  } catch {
    body = {};
  }
  const result = await deleteJournalAccount({
    anglerId: viewerId,
    password: typeof body.password === "string" ? body.password : "",
    confirm: typeof body.confirm === "string" ? body.confirm : "",
  });
  if (!result.ok) {
    return jsonWithViewer({ error: result.error }, viewerId, { status: result.status }, true);
  }
  return clearAuthCookies(NextResponse.json({ ok: true, signedIn: false }));
}
