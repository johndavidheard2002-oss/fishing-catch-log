import { and, eq, lt } from "drizzle-orm";
import { getAngler } from "./anglers";
import { getEntitlementRow } from "./entitlement";
import { ensureDb } from "./index";
import { getRow } from "./query";
import { catches } from "./schema";
import { isPlanReviewAccount, planGrandfatherCutoff, serverPlanSubscribed } from "../plan-gate";

export type PlanGateSnapshot = {
  grandfathered: boolean;
  subscribed: boolean;
};

export async function readPlanGate(anglerId: string, now = new Date()): Promise<PlanGateSnapshot> {
  const angler = await getAngler(anglerId, { includeEmail: true });
  const row = await getEntitlementRow(anglerId);
  const subscribed = serverPlanSubscribed(row, now);
  const cutoff = planGrandfatherCutoff();
  const reviewAccount = isPlanReviewAccount(angler?.email);
  if (!cutoff || reviewAccount) {
    return { grandfathered: false, subscribed };
  }
  const db = await ensureDb();
  const prior = await getRow(
    db
      .select()
      .from(catches)
      .where(and(eq(catches.anglerId, anglerId), lt(catches.createdAt, cutoff)))
      .limit(1),
  );
  return { grandfathered: Boolean(prior), subscribed };
}
