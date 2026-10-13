import { eq } from "drizzle-orm";
import { getEntitlementRow } from "./entitlement";
import { ensureDb } from "./index";
import { getRow } from "./query";
import { catches } from "./schema";
import { serverPlanSubscribed } from "../plan-gate";

export type PlanGateSnapshot = {
  hasCatches: boolean;
  subscribed: boolean;
};

export async function readPlanGate(anglerId: string, now = new Date()): Promise<PlanGateSnapshot> {
  const row = await getEntitlementRow(anglerId);
  const subscribed = serverPlanSubscribed(row, now);
  const db = await ensureDb();
  const prior = await getRow(
    db.select().from(catches).where(eq(catches.anglerId, anglerId)).limit(1),
  );
  return { hasCatches: Boolean(prior), subscribed };
}
