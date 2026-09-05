import { APP_DISPLAY_NAME, APP_SUBTITLE } from "./brand";

export const YEARLY_PRICE_USD = 39.99;
export const YEARLY_PRICE_LABEL = "$39.99/year";
export const TRIAL_DAYS_DEFAULT = 30;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const SUBSCRIPTION_STATUSES = ["trial", "active", "expired"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const TRIAL_NOTICE_WINDOWS = ["7d", "3d", "1d"] as const;
export type TrialNoticeWindow = (typeof TRIAL_NOTICE_WINDOWS)[number];

export type EntitlementSnapshot = {
  subscriptionStatus: SubscriptionStatus;
  trialStartedAt: string;
  trialEndsAt: string;
  trialDays: number;
  daysRemaining: number;
  msRemaining: number;
  noticeWindow: TrialNoticeWindow | null;
  yearlyPrice: typeof YEARLY_PRICE_LABEL;
  purchaseAvailable: boolean;
};

export const JOURNAL_LOCKED = "Subscribe to keep your journal unlocked.";

export const PAYWALL_HEADLINE = "Your free month ended";
export const PAYWALL_BODY = `Renew for ${YEARLY_PRICE_LABEL} to keep your private saltwater logbook unlocked. Your catches, photos, and spots are safe — nothing was deleted.`;
export const PAYWALL_STORE_NOTE =
  "Purchase will be through the App Store. Coming with the App Store build.";
export const PAYWALL_STORE_NOTE_NATIVE =
  "Billed through the App Store as Tide Mark Premium. Restore purchases if you already subscribed on this Apple ID.";
export const PAYWALL_RESTORE_LABEL = "Restore purchases";
export const TRIAL_OFFER_LINE = `First month free. Then ${YEARLY_PRICE_LABEL} to keep the journal unlocked.`;
export const OPEN_PAYWALL_EVENT = "tidemark-open-paywall";
export const TRIAL_NOTICE_EVENT = "tidemark-trial-notice";

export function openPaywall() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_PAYWALL_EVENT));
}

export const HOME_UNLOCKED_PATHS = ["/", "/privacy"] as const;

/** Journal surfaces that must not render or navigate when the trial has expired. */
export function isJournalLockedPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/privacy" || pathname.startsWith("/privacy/")) return false;
  if (pathname === "/signin" || pathname.startsWith("/signin/")) return false;
  if (pathname.startsWith("/api/")) return false;
  return true;
}

export function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return typeof value === "string" && (SUBSCRIPTION_STATUSES as readonly string[]).includes(value);
}

export function journalUnlocked(status: SubscriptionStatus): boolean {
  return status === "trial" || status === "active";
}

export function trialDurationMs(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): number {
  const raw = env.TIDEMARK_TRIAL_DAYS;
  if (raw == null || raw.trim() === "") return TRIAL_DAYS_DEFAULT * DAY_MS;
  const days = Number(raw);
  if (!Number.isFinite(days) || days <= 0) return TRIAL_DAYS_DEFAULT * DAY_MS;
  return days * DAY_MS;
}

export function forcedEntitlement(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): SubscriptionStatus | null {
  const raw = env.TIDEMARK_FORCE_ENTITLEMENT?.trim().toLowerCase();
  return isSubscriptionStatus(raw) ? raw : null;
}

export function addMs(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}

export function trialEndsAt(trialStartedAt: string, durationMs = trialDurationMs()): string {
  return addMs(trialStartedAt, durationMs);
}

export function trialNoticeWindow(msRemaining: number): TrialNoticeWindow | null {
  if (msRemaining <= 0) return null;
  const days = msRemaining / DAY_MS;
  if (days <= 1) return "1d";
  if (days <= 3) return "3d";
  if (days <= 7) return "7d";
  return null;
}

export function computeSubscriptionStatus(args: {
  now?: Date;
  trialStartedAt: string;
  storedStatus?: string | null;
  subscriptionExpiresAt?: string | null;
  durationMs?: number;
  forceStatus?: SubscriptionStatus | null;
}): SubscriptionStatus {
  if (args.forceStatus) return args.forceStatus;
  const now = args.now ?? new Date();
  const stored = args.storedStatus?.trim().toLowerCase();
  if (stored === "expired") return "expired";
  if (stored === "active") {
    const expires = args.subscriptionExpiresAt ? new Date(args.subscriptionExpiresAt) : null;
    if (!expires || Number.isNaN(expires.getTime()) || expires.getTime() > now.getTime()) {
      return "active";
    }
    return "expired";
  }
  const duration = args.durationMs ?? trialDurationMs();
  const ends = new Date(args.trialStartedAt).getTime() + duration;
  if (!Number.isFinite(ends)) return "expired";
  return ends > now.getTime() ? "trial" : "expired";
}

export function buildEntitlement(args: {
  now?: Date;
  trialStartedAt: string;
  storedStatus?: string | null;
  subscriptionExpiresAt?: string | null;
  durationMs?: number;
  forceStatus?: SubscriptionStatus | null;
  purchaseAvailable?: boolean;
}): EntitlementSnapshot {
  const now = args.now ?? new Date();
  const durationMs = args.durationMs ?? trialDurationMs();
  const trialEnds = trialEndsAt(args.trialStartedAt, durationMs);
  const subscriptionStatus = computeSubscriptionStatus({
    now,
    trialStartedAt: args.trialStartedAt,
    storedStatus: args.storedStatus,
    subscriptionExpiresAt: args.subscriptionExpiresAt,
    durationMs,
    forceStatus: args.forceStatus,
  });
  const msRemaining = Math.max(0, new Date(trialEnds).getTime() - now.getTime());
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / DAY_MS));
  return {
    subscriptionStatus,
    trialStartedAt: args.trialStartedAt,
    trialEndsAt: trialEnds,
    trialDays: durationMs / DAY_MS,
    daysRemaining: subscriptionStatus === "trial" ? daysRemaining : 0,
    msRemaining: subscriptionStatus === "trial" ? msRemaining : 0,
    noticeWindow: subscriptionStatus === "trial" ? trialNoticeWindow(msRemaining) : null,
    yearlyPrice: YEARLY_PRICE_LABEL,
    purchaseAvailable: args.purchaseAvailable === true,
  };
}

export function trialNoticeTitle(window: TrialNoticeWindow): string {
  if (window === "1d") return "Your free month ends tomorrow";
  if (window === "3d") return "Your free month ends in a few days";
  return "Your free month ends in a week";
}

export function trialNoticeBody(window: TrialNoticeWindow): string {
  const when =
    window === "1d" ? "tomorrow" : window === "3d" ? "in about 3 days" : "in about 7 days";
  return `${APP_DISPLAY_NAME} stays a ${APP_SUBTITLE.toLowerCase()}. After the free month, ${YEARLY_PRICE_LABEL} keeps Log, Calendar, and the rest unlocked. Trial ends ${when}. Your data stays safe.`;
}

export function localDayKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function trialNoticeDismissKey(anglerId: string, window: TrialNoticeWindow, dayKey: string): string {
  return `tidemark-trial-notice:${anglerId}:${window}:${dayKey}`;
}

export function paywallCopy(opts?: { native?: boolean }) {
  const native = opts?.native === true;
  return {
    brand: APP_DISPLAY_NAME,
    subtitle: APP_SUBTITLE,
    headline: PAYWALL_HEADLINE,
    body: PAYWALL_BODY,
    yearlyPrice: YEARLY_PRICE_LABEL,
    storeNote: native ? PAYWALL_STORE_NOTE_NATIVE : PAYWALL_STORE_NOTE,
    subscribeLabel: `Subscribe — ${YEARLY_PRICE_LABEL}`,
    restoreLabel: PAYWALL_RESTORE_LABEL,
  };
}
