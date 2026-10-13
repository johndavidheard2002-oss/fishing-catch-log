/** Shown under the trial line, in the same small type. */
export const PLAN_REQUIRED_NOTE =
  "A subscription is required to keep using Tide Mark after the trial.";

/** Non-link note on disabled log and plan controls. Not a route to the paywall. */
export const PLAN_LOGGING_NOTE = "Subscribe on the Home screen to log catches.";

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
 * Tide Mark 2.0 only. The website, Android, and Tide Mark 1.0 pass native: false
 * and stay open. StoreKit's 1-month trial counts as entitled.
 * A native account without a current plan can still open the app. Logging and
 * plan edits stay locked for every account, including ones that already have catches.
 */
export function planAppAccess(args: {
  native: boolean;
  serverSubscribed: boolean;
  storekitEntitled: boolean;
}): PlanAppAccess {
  if (!args.native) return "open";
  if (args.serverSubscribed || args.storekitEntitled) return "open";
  return "locked";
}

/** Screens that must not wait on the logging check. The purchase screen is one of them. */
export function planGateAllowsPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname === "/signin" || pathname.startsWith("/signin/")) return true;
  if (pathname === "/privacy" || pathname.startsWith("/privacy/")) return true;
  if (pathname === "/subscribe" || pathname.startsWith("/subscribe/")) return true;
  if (pathname === "/dev/plan-paywall") return true;
  return false;
}
