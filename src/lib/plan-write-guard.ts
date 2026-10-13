import { NextRequest, NextResponse } from "next/server";
import { getAngler } from "./db/anglers";
import { readPlanGate } from "./db/plan-gate";
import { isCompAccountEmail } from "./plan-comp";
import { PLAN_WRITE_BLOCKED } from "./plan-gate";
import { userAgentHasPlanPurchaseShell } from "./plan-iap";

/**
 * Blocks journal writes only from a native shell that reports version 2.0+
 * and build >= 14 (the first build with a working TideMarkStore purchase).
 * The website, Tide Mark 1.0, and older TestFlight builds stay open.
 * Comp accounts stay open on every build.
 */
export async function nativePlanWriteResponse(
  request: NextRequest,
  viewerId: string,
): Promise<NextResponse | null> {
  const userAgent = request.headers.get("user-agent") ?? "";
  if (!userAgentHasPlanPurchaseShell(userAgent)) return null;
  const angler = await getAngler(viewerId, { includeEmail: true });
  if (isCompAccountEmail(angler?.email)) return null;
  const gate = await readPlanGate(viewerId);
  if (gate.subscribed) return null;
  return NextResponse.json({ error: PLAN_WRITE_BLOCKED, locked: true }, { status: 403 });
}
