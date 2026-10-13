import { NextRequest, NextResponse } from "next/server";
import { readPlanGate } from "./db/plan-gate";
import { PLAN_WRITE_BLOCKED } from "./plan-gate";
import { userAgentHasPlanIap } from "./plan-iap";

/** Blocks journal writes from Tide Mark 2.0 when the Plan term is not current. Web and 1.0 stay open. */
export async function nativePlanWriteResponse(
  request: NextRequest,
  viewerId: string,
): Promise<NextResponse | null> {
  if (!userAgentHasPlanIap(request.headers.get("user-agent") ?? "")) return null;
  const gate = await readPlanGate(viewerId);
  if (gate.subscribed) return null;
  return NextResponse.json({ error: PLAN_WRITE_BLOCKED, locked: true }, { status: 403 });
}
