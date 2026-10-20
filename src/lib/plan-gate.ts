/** Shown under the trial line, in the same small type. */
export const PLAN_REQUIRED_NOTE =
  "A subscription is required to keep using Tide Mark after the trial.";

/** Shown on every Tide Mark 2.0 tab when StoreKit has no current plan or trial. */
export const PLAN_SUBSCRIBE_CARD_TITLE = "Tide Mark Plan";

/** API message when a 2.0 write is blocked. The tab card is the way to subscribe. */
export const PLAN_WRITE_BLOCKED = "Tide Mark Plan is required to log catches.";

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

export type PlanAppAccess = "open" | "locked";

/**
 * Native shell that can buy Tide Mark Plan: iOS build 14+ or the Android app
 * with the same user-agent marker. The website, Tide Mark 1.0, and older
 * TestFlight builds pass native: false and stay open.
 * The store on that shell (StoreKit or Google Play) is the source of truth,
 * including a current free trial. A stored server flag does not hide the
 * subscribe card when the store says the term has ended.
 */
export function planAppAccess(args: {
  native: boolean;
  storekitEntitled: boolean;
}): PlanAppAccess {
  if (!args.native) return "open";
  if (args.storekitEntitled) return "open";
  return "locked";
}

/** Screens that must not wait on the logging check. The purchase screen is one of them. */
export function planGateAllowsPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname === "/signin" || pathname.startsWith("/signin/")) return true;
  if (pathname === "/privacy" || pathname.startsWith("/privacy/")) return true;
  if (pathname === "/terms" || pathname.startsWith("/terms/")) return true;
  if (pathname === "/subscribe" || pathname.startsWith("/subscribe/")) return true;
  if (pathname === "/dev/plan-paywall") return true;
  return false;
}
