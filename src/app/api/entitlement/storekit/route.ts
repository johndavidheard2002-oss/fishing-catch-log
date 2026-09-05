import { NextRequest, NextResponse } from "next/server";
import { activateFromStorekit } from "@/lib/db/entitlement";
import { jsonWithViewer, requireViewerId, signInRequired } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Persist an App Store purchase or restore for tidemark_premium_yearly.
 * Web trial stays on the existing clock; this only writes subscription_status.
 */
export async function POST(request: NextRequest) {
  const viewerId = await requireViewerId(request);
  if (!viewerId) return signInRequired();
  const body = await request.json().catch(() => null);
  const result = await activateFromStorekit(viewerId, body);
  if ("error" in result) {
    return jsonWithViewer({ error: result.error }, viewerId, { status: 400 }, true);
  }
  return jsonWithViewer(
    {
      ok: true,
      entitlement: result.entitlement,
      productId: result.claim.productId,
      source: result.claim.source,
    },
    viewerId,
    undefined,
    true,
  );
}

export async function GET() {
  return NextResponse.json({ error: "Use POST to activate a StoreKit purchase or restore." }, { status: 405 });
}
