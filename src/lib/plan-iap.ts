import { PLAN_REQUIRED_NOTE } from "./plan-gate";
import {
  APP_STORE_PLAN_MONTHLY_PRODUCT_ID,
  APP_STORE_PLAN_PRICE,
  APP_STORE_PLAN_PRODUCT_ID,
  APP_STORE_PLAN_SUBSCRIPTION_GROUP,
  APP_STORE_PLAN_TRIAL,
  APP_STORE_PLAN_YEARLY_PRODUCT_ID,
  APPLE_STANDARD_EULA_URL,
  NATIVE_PLAN_IAP_UA_TOKEN,
} from "./native-app";

export const PLAN_PRODUCT_ID = APP_STORE_PLAN_PRODUCT_ID;
export const PLAN_LEGACY_YEARLY_PRODUCT_ID = APP_STORE_PLAN_YEARLY_PRODUCT_ID;
export const PLAN_LEGACY_MONTHLY_PRODUCT_ID = APP_STORE_PLAN_MONTHLY_PRODUCT_ID;
export const PLAN_SUBSCRIPTION_GROUP = APP_STORE_PLAN_SUBSCRIPTION_GROUP;
export const PLAN_PRICE_LABEL = APP_STORE_PLAN_PRICE;
export const PLAN_OFFER_LINE = `${PLAN_PRICE_LABEL} · ${APP_STORE_PLAN_TRIAL}`;
export const PLAN_TITLE = "Tide Mark Plan";
export const PLAN_PERIOD_LABEL = "1 year";
export const PLAN_UA_TOKEN = NATIVE_PLAN_IAP_UA_TOKEN;
export const PLAN_TERMS_URL = APPLE_STANDARD_EULA_URL;

const ACCEPTED_PLAN_PRODUCT_IDS = [
  PLAN_PRODUCT_ID,
  PLAN_LEGACY_YEARLY_PRODUCT_ID,
  PLAN_LEGACY_MONTHLY_PRODUCT_ID,
] as const;

export function isAcceptedPlanProductId(value: string): boolean {
  return (ACCEPTED_PLAN_PRODUCT_IDS as readonly string[]).includes(value);
}

export const PLAN_KEEP_LINE = "Subscribe to continue using Tide Mark, with full access to every feature.";

export const PLAN_AUTORENEW_TERMS =
  `Tide Mark Plan is a 1-year subscription at ${PLAN_PRICE_LABEL} after a 1-month free trial. Payment is charged to your Apple ID when you confirm the purchase. It renews automatically each year unless you cancel at least 24 hours before the end of the current period. Your account is charged ${PLAN_PRICE_LABEL} for renewal within 24 hours before the period ends. Manage or cancel anytime in Settings → Apple ID → Subscriptions. Any unused part of a free trial is forfeited if you buy a subscription before the trial ends.`;

/** Copy that must never appear on the Plan paywall. */
const DISCOURAGED_PAYWALL_NOTES = [
  /don['’]t buy/i,
  /do not buy/i,
  /unless you have/i,
  /need logged catches/i,
  /keep using the app free/i,
  /only if you have catches/i,
];

export const PLAN_STATUSES = ["active", "expired", "none"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export type PlanOffer = {
  nativePlanIap: boolean;
  productId: string;
  displayPrice: string | null;
  displayName: string | null;
  periodUnit: string | null;
  periodValue: number | null;
  introPaymentMode: string | null;
  introPeriodUnit: string | null;
  introPeriodValue: number | null;
  introDisplayPrice: string | null;
  entitled: boolean;
  status: PlanStatus;
  expiresAt: string | null;
  transactionId: string | null;
  originalTransactionId: string | null;
  restored?: boolean;
};

export type PlanAccess =
  | { mode: "free" }
  | { mode: "paywall"; offer: PlanOffer }
  | { mode: "unlocked"; offer: PlanOffer };

export function userAgentHasPlanIap(userAgent: string): boolean {
  return userAgent.includes(PLAN_UA_TOKEN);
}

/**
 * Show Tide Mark Plan for the 2.0 shell only.
 *
 * The user-agent token and the TideMarkStore header are enough on their own.
 * Build 9 sets WKAppBoundDomains without limitsNavigationsToAppBoundDomains,
 * so WebKit does not inject the Capacitor bridge and isNativePlatform() is
 * false even inside that app. The token is still appended on the web view.
 *
 * Generic native iOS is not enough: Tide Mark 1.0 is native and must stay
 * paywall-free. The website stub of TideMarkStore is not enough either.
 */
export function planIapBuildAvailable(args: {
  nativeIos: boolean;
  userAgent: string;
  pluginAvailable?: boolean;
  pluginHeader?: boolean;
}): boolean {
  if (userAgentHasPlanIap(args.userAgent)) return true;
  if (args.pluginHeader === true) return true;
  return args.nativeIos && args.pluginAvailable === true;
}

export function isPlanStatus(value: unknown): value is PlanStatus {
  return typeof value === "string" && (PLAN_STATUSES as readonly string[]).includes(value);
}

export function fallbackPlanOffer(): PlanOffer {
  return {
    nativePlanIap: true,
    productId: PLAN_PRODUCT_ID,
    displayPrice: null,
    displayName: PLAN_TITLE,
    periodUnit: "year",
    periodValue: 1,
    introPaymentMode: "freeTrial",
    introPeriodUnit: "month",
    introPeriodValue: 1,
    introDisplayPrice: null,
    entitled: false,
    status: "none",
    expiresAt: null,
    transactionId: null,
    originalTransactionId: null,
  };
}

function asText(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function planOfferFromPlugin(raw: unknown): PlanOffer | null {
  const body = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!body || body.nativePlanIap !== true) return null;
  const productId = asText(body.productId) ?? PLAN_PRODUCT_ID;
  if (!isAcceptedPlanProductId(productId)) return null;
  const status = isPlanStatus(body.status) ? body.status : body.entitled === true ? "active" : "none";
  return {
    nativePlanIap: true,
    productId,
    displayPrice: asText(body.displayPrice),
    displayName: asText(body.displayName),
    periodUnit: asText(body.periodUnit),
    periodValue: asCount(body.periodValue),
    introPaymentMode: asText(body.introPaymentMode),
    introPeriodUnit: asText(body.introPeriodUnit),
    introPeriodValue: asCount(body.introPeriodValue),
    introDisplayPrice: asText(body.introDisplayPrice),
    entitled: body.entitled === true,
    status,
    expiresAt: asText(body.expiresAt) ?? asText(body.expiresDate),
    transactionId: asText(body.transactionId),
    originalTransactionId: asText(body.originalTransactionId),
    restored: typeof body.restored === "boolean" ? body.restored : undefined,
  };
}

export function offerIsEntitled(offer: PlanOffer, now = new Date()): boolean {
  if (!offer.nativePlanIap || !isAcceptedPlanProductId(offer.productId)) return false;
  if (!offer.entitled || offer.status === "expired") return false;
  if (offer.expiresAt) {
    const ends = new Date(offer.expiresAt).getTime();
    if (Number.isFinite(ends) && ends <= now.getTime()) return false;
  }
  return true;
}

export function planAccessFromProbe(args: {
  nativeBuild: boolean;
  offer: PlanOffer | null;
  now?: Date;
}): PlanAccess {
  if (!args.nativeBuild) return { mode: "free" };
  const offer = args.offer ?? fallbackPlanOffer();
  if (!isAcceptedPlanProductId(offer.productId) || offer.nativePlanIap !== true) {
    return { mode: "paywall", offer: fallbackPlanOffer() };
  }
  if (offerIsEntitled(offer, args.now)) return { mode: "unlocked", offer };
  return { mode: "paywall", offer };
}

export function planPriceLabel(offer?: Partial<PlanOffer> | null): string {
  const raw = offer?.displayPrice?.trim();
  if (!raw) return PLAN_PRICE_LABEL;
  if (raw.includes("/")) return raw;
  const unit = (offer?.periodUnit ?? "year").toLowerCase();
  const value = offer?.periodValue ?? 1;
  if (value === 1 && (unit === "month" || unit === "year" || unit === "week" || unit === "day")) {
    return `${raw}/${unit}`;
  }
  return raw;
}

/** Subordinate to the billed amount. Must stay smaller and lighter than the price. */
export const PLAN_TRIAL_NOTE =
  "Try Tide Mark Plan free for 1 month. Cancel anytime before the trial ends and you won't be charged. After the trial, it renews at $19.99/year until canceled.";

export { PLAN_REQUIRED_NOTE };

export function planSubscribeLabel(offer: PlanOffer): string {
  return `Subscribe – ${planPriceLabel(offer)}`;
}

export function planPaywallCopy(offer?: Partial<PlanOffer> | null) {
  return {
    title: PLAN_TITLE,
    length: PLAN_PERIOD_LABEL,
    price: planPriceLabel(offer),
    trialNote: PLAN_TRIAL_NOTE,
    requiredNote: PLAN_REQUIRED_NOTE,
    keepLine: PLAN_KEEP_LINE,
    autoRenew: PLAN_AUTORENEW_TERMS,
    termsUrl: PLAN_TERMS_URL,
    subscribeLabel: planSubscribeLabel({ ...fallbackPlanOffer(), ...offer, status: offer?.status ?? "none" }),
    restoreLabel: "Restore Purchases",
  };
}

export function planPaywallDiscouragesPurchase(text: string): boolean {
  return DISCOURAGED_PAYWALL_NOTES.some((pattern) => pattern.test(text));
}

/** Visible only when the subscribe URL includes `?debug=1`. */
export function planDiagnosticsRequested(search: string): boolean {
  const query = search.trim().replace(/^\?/, "");
  return new URLSearchParams(query).get("debug") === "1";
}

const STOREKIT_IOS_APP_ONLY = /storekit is only available in the tide mark ios app/i;

/**
 * That sentence is the web stub. Inside the iOS app it is noise on the paywall.
 * The plain website can still show it.
 */
export function planStorekitErrorForViewer(message: string, insideIosApp: boolean): string | null {
  if (insideIosApp && STOREKIT_IOS_APP_ONLY.test(message)) return null;
  return message;
}

export function planPaywallText(): string {
  const copy = planPaywallCopy(fallbackPlanOffer());
  return [copy.title, copy.price, copy.trialNote, copy.requiredNote, copy.length, copy.keepLine, copy.autoRenew, copy.subscribeLabel].join(
    "\n",
  );
}
