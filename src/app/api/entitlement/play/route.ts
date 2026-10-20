import { NextRequest, NextResponse } from "next/server";
import { activateFromPlay } from "@/lib/db/entitlement";
import { jsonWithViewer, requireViewerId, signInRequired } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Persist a Google Play purchase or restore for tidemark_plan_yearly.
 * Verification uses purchases.subscriptionsv2 when the service account env
 * vars are set. Without them the device purchase is stored and the response
 * says verification is unconfigured. The StoreKit route is unchanged.
 */
export async function POST(request: NextRequest) {
  const viewerId = await requireViewerId(request);
  if (!viewerId) return signInRequired();
  const body = await request.json().catch(() => null);
  const result = await activateFromPlay(viewerId, body);
  if ("error" in result) {
    return jsonWithViewer({ error: result.error }, viewerId, { status: 400 }, true);
  }
  return jsonWithViewer(
    {
      ok: true,
      entitlement: result.entitlement,
      productId: result.claim.productId,
      source: result.claim.source,
      verified: result.verified,
      verification: result.verification,
    },
    viewerId,
    undefined,
    true,
  );
}

export async function GET() {
  return NextResponse.json(
    { error: "Use POST to activate a Google Play purchase or restore." },
    { status: 405 },
  );
}
