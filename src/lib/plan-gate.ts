/** Client-safe. Do not import auth or the database from this module. */
function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Catches created before this instant grandfather the account on Tide Mark 2.0.
 * Move it when the subscription build ships. Override with
 * TIDEMARK_PLAN_GRANDFATHER_BEFORE. Set TIDEMARK_PLAN_GRANDFATHER=0 to turn
 * grandfathering off for every account.
 */
export const PLAN_GRANDFATHER_BEFORE_DEFAULT = "2026-10-13T12:00:00.000Z";

/** Shown under the trial line, in the same small type. */
export const PLAN_REQUIRED_NOTE =
  "A subscription is required to keep using Tide Mark after the trial.";

type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;

export function planGrandfatherEnabled(env: Env = process.env): boolean {
  const raw = env.TIDEMARK_PLAN_GRANDFATHER?.trim().toLowerCase();
  return raw !== "0" && raw !== "off" && raw !== "false";
}

/** Null when grandfathering is off or the cutoff cannot be read. */
export function planGrandfatherCutoff(env: Env = process.env): string | null {
  if (!planGrandfatherEnabled(env)) return null;
  const raw = env.TIDEMARK_PLAN_GRANDFATHER_BEFORE?.trim();
  const source = raw || PLAN_GRANDFATHER_BEFORE_DEFAULT;
  const time = new Date(source).getTime();
  if (!Number.isFinite(time)) return PLAN_GRANDFATHER_BEFORE_DEFAULT;
  return new Date(time).toISOString();
}

/**
 * These accounts always see the paywall, even with older catches, so App Review
 * can buy in the sandbox. Comma-separated. Leave empty unless a preloaded demo
 * account already has catches from before the cutoff.
 */
export function planReviewAccountEmails(env: Env = process.env): string[] {
  return (env.TIDEMARK_PLAN_REVIEW_EMAILS ?? "")
    .split(",")
    .map((part) => normalizeEmail(part))
    .filter(Boolean);
}

export function isPlanReviewAccount(email: string | null | undefined, env: Env = process.env): boolean {
  if (!email) return false;
  const normalized = normalizeEmail(email);
  return planReviewAccountEmails(env).includes(normalized);
}

export function catchGrandfathersAccount(
  createdAt: string,
  cutoff: string | null,
): boolean {
  if (!cutoff) return false;
  const created = new Date(createdAt).getTime();
  const cut = new Date(cutoff).getTime();
  if (!Number.isFinite(created) || !Number.isFinite(cut)) return false;
  return created < cut;
}

export function accountIsGrandfathered(args: {
  catchCreatedAts: string[];
  reviewAccount?: boolean;
  cutoff?: string | null;
}): boolean {
  if (args.reviewAccount) return false;
  const cutoff = args.cutoff === undefined ? planGrandfatherCutoff() : args.cutoff;
  return args.catchCreatedAts.some((createdAt) => catchGrandfathersAccount(createdAt, cutoff));
}

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

export type PlanAppAccess = "open" | "paywall";

/**
 * Tide Mark 2.0 only. The website, Android, and Tide Mark 1.0 pass native: false
 * and stay open. StoreKit's 1-month trial counts as entitled.
 */
export function planAppAccess(args: {
  native: boolean;
  grandfathered: boolean;
  serverSubscribed: boolean;
  storekitEntitled: boolean;
}): PlanAppAccess {
  if (!args.native) return "open";
  if (args.grandfathered || args.serverSubscribed || args.storekitEntitled) return "open";
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
