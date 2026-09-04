import { NextRequest, NextResponse } from "next/server";
import { JOURNAL_LOCKED, YEARLY_PRICE_LABEL, journalUnlocked, type EntitlementSnapshot } from "./entitlement";
import { getEntitlementForAngler } from "./db/entitlement";
import { jsonWithViewer, requireViewerId, signInRequired } from "./viewer";

export { JOURNAL_LOCKED };

export function journalLockedResponse(viewerId: string, entitlement: EntitlementSnapshot): NextResponse {
  return jsonWithViewer(
    { error: JOURNAL_LOCKED, locked: true, entitlement },
    viewerId,
    { status: 403 },
    true,
  );
}

export async function requireUnlockedViewer(
  request: NextRequest,
): Promise<{ ok: true; viewerId: string } | { ok: false; response: NextResponse }> {
  const viewerId = await requireViewerId(request);
  if (!viewerId) return { ok: false, response: signInRequired() };
  const entitlement = await getEntitlementForAngler(viewerId);
  if (!entitlement || !journalUnlocked(entitlement.subscriptionStatus)) {
    return {
      ok: false,
      response: journalLockedResponse(
        viewerId,
        entitlement ?? {
          subscriptionStatus: "expired",
          trialStartedAt: "",
          trialEndsAt: "",
          trialDays: 30,
          daysRemaining: 0,
          msRemaining: 0,
          noticeWindow: null,
          yearlyPrice: YEARLY_PRICE_LABEL,
          purchaseAvailable: false,
        },
      ),
    };
  }
  return { ok: true, viewerId };
}
