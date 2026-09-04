import { eq } from "drizzle-orm";
import {
  buildEntitlement,
  forcedEntitlement,
  isSubscriptionStatus,
  trialDurationMs,
  type EntitlementSnapshot,
  type SubscriptionStatus,
} from "../entitlement";
import { getAngler } from "./anglers";
import { ensureDb } from "./index";
import { getRow, runChange } from "./query";
import { anglers } from "./schema";

export type EntitlementRow = {
  trialStartedAt: string | null;
  subscriptionStatus: string | null;
  subscriptionExpiresAt: string | null;
};

function mapRow(row: typeof anglers.$inferSelect): EntitlementRow {
  return {
    trialStartedAt: row.trialStartedAt ?? null,
    subscriptionStatus: row.subscriptionStatus ?? "trial",
    subscriptionExpiresAt: row.subscriptionExpiresAt ?? null,
  };
}

export async function getEntitlementRow(anglerId: string): Promise<EntitlementRow | null> {
  const db = await ensureDb();
  const row = await getRow(db.select().from(anglers).where(eq(anglers.id, anglerId)));
  return row ? mapRow(row) : null;
}

/** Start the trial clock once. Later logins must not move trial_started_at. */
export async function ensureTrialStarted(anglerId: string, now = new Date()): Promise<string> {
  const existing = await getEntitlementRow(anglerId);
  if (existing?.trialStartedAt) return existing.trialStartedAt;
  const stamp = now.toISOString();
  const db = await ensureDb();
  await runChange(
    db
      .update(anglers)
      .set({
        trialStartedAt: stamp,
        subscriptionStatus: existing?.subscriptionStatus || "trial",
      })
      .where(eq(anglers.id, anglerId)),
  );
  const after = await getEntitlementRow(anglerId);
  return after?.trialStartedAt || stamp;
}

export async function getEntitlementForAngler(
  anglerId: string,
  now = new Date(),
): Promise<EntitlementSnapshot | null> {
  const angler = await getAngler(anglerId);
  if (!angler) return null;
  const trialStartedAt = await ensureTrialStarted(anglerId, now);
  const row = await getEntitlementRow(anglerId);
  return buildEntitlement({
    now,
    trialStartedAt,
    storedStatus: row?.subscriptionStatus,
    subscriptionExpiresAt: row?.subscriptionExpiresAt,
    durationMs: trialDurationMs(),
    forceStatus: forcedEntitlement(),
  });
}

export async function setStoredSubscription(
  anglerId: string,
  args: {
    status?: SubscriptionStatus;
    trialStartedAt?: string;
    subscriptionExpiresAt?: string | null;
  },
): Promise<EntitlementSnapshot | null> {
  const existing = await getEntitlementRow(anglerId);
  if (!existing) return null;
  const db = await ensureDb();
  await runChange(
    db
      .update(anglers)
      .set({
        subscriptionStatus: args.status ?? existing.subscriptionStatus ?? "trial",
        trialStartedAt: args.trialStartedAt ?? existing.trialStartedAt,
        subscriptionExpiresAt:
          args.subscriptionExpiresAt === undefined
            ? existing.subscriptionExpiresAt
            : args.subscriptionExpiresAt,
      })
      .where(eq(anglers.id, anglerId)),
  );
  return getEntitlementForAngler(anglerId);
}

export function parseQaStatus(value: unknown): SubscriptionStatus | null {
  return isSubscriptionStatus(value) ? value : null;
}
