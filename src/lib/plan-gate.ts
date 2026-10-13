/** Shown under the trial line, in the same small type. */
export const PLAN_REQUIRED_NOTE =
  "A subscription is required to keep using Tide Mark after the trial.";

/** Where a signed-in non-subscriber with logged catches starts. */
export const PLAN_READONLY_HOME = "/calendar?view=list";

/** A stored StoreKit term. The journal's own "trial" clock is not a Plan subscription. */
export function serverPlanSubscribed(
  row: { subscriptionStatus: string | null; subscriptionExpiresAt: string | null } | null | undefined,
  now = new Date(),
): boolean {
  if (!row || row.subscriptionStatus !== "active") return false;
  if (!row.subscriptionExpiresAt) return true;
  const ends = new Date(row.subscriptionExpiresAt).getTime();
  if (!Number.isFinite(ends)) return true;
  return ends > now.getTime();
}

export type PlanAppAccess = "open" | "readonly" | "paywall";

/**
 * Tide Mark 2.0 only. The website, Android, and Tide Mark 1.0 pass native: false
 * and stay open. StoreKit's 1-month trial counts as entitled.
 * A native account with logged catches, and no current plan, can view those
 * catches and nothing else.
 */
export function planAppAccess(args: {
  native: boolean;
  hasCatches: boolean;
  serverSubscribed: boolean;
  storekitEntitled: boolean;
}): PlanAppAccess {
  if (!args.native) return "open";
  if (args.serverSubscribed || args.storekitEntitled) return "open";
  if (args.hasCatches) return "readonly";
  return "paywall";
}

/** Screens Apple requires without a subscription, plus the purchase screen itself. */
export function planGateAllowsPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname === "/signin" || pathname.startsWith("/signin/")) return true;
  if (pathname === "/privacy" || pathname.startsWith("/privacy/")) return true;
  if (pathname === "/subscribe" || pathname.startsWith("/subscribe/")) return true;
  if (pathname === "/dev/plan-paywall") return true;
  return false;
}

/** Calendar Log and an already-logged catch. Not Log, Plan, the map, or Home. */
export function planCatchViewPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname === "/calendar" || pathname.startsWith("/calendar/")) return true;
  if (pathname === "/history" || pathname.startsWith("/history/")) return true;
  if (pathname === "/catch" || pathname.startsWith("/catch/")) return true;
  return false;
}
