import {
  APP_STORE_PLAN_PRICE,
  APP_STORE_PLAN_PRODUCT_ID,
  APP_STORE_PLAN_SUBSCRIPTION_GROUP,
  APPLE_STANDARD_EULA_URL,
  NATIVE_PLAN_IAP_UA_TOKEN,
} from "./native-app";

export const PLAN_PRODUCT_ID = APP_STORE_PLAN_PRODUCT_ID;
export const PLAN_SUBSCRIPTION_GROUP = APP_STORE_PLAN_SUBSCRIPTION_GROUP;
export const PLAN_PRICE_LABEL = APP_STORE_PLAN_PRICE;
export const PLAN_TITLE = "Tide Mark Plan";
export const PLAN_PERIOD_LABEL = "1 month";
export const PLAN_UA_TOKEN = NATIVE_PLAN_IAP_UA_TOKEN;
export const PLAN_TERMS_URL = APPLE_STANDARD_EULA_URL;

export const PLAN_INCLUDES = [
  "Matching tide for each logged catch on the plan day — same height and incoming or outgoing.",
  "Notes on the plan.",
  "That day’s tides.",
] as const;

export const PLAN_AUTORENEW_TERMS =
  "Payment is charged to your Apple ID when you confirm the purchase. Tide Mark Plan renews automatically unless you cancel at least 24 hours before the end of the current period. Your account is charged for renewal within 24 hours before the period ends. Manage or cancel anytime in Settings → Apple ID → Subscriptions. Any unused part of a free trial is forfeited if you buy a subscription before the trial ends.";

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
 * Plan is paid only in the 2.0 iOS shell. The website and the 1.0 binary
 * (no user-agent token) keep Plan included.
 */
export function planIapBuildAvailable(args: {
  nativeIos: boolean;
  userAgent: string;
}): boolean {
  return args.nativeIos && userAgentHasPlanIap(args.userAgent);
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
    periodUnit: "month",
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
  if (productId !== PLAN_PRODUCT_ID) return null;
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
  if (!offer.nativePlanIap || offer.productId !== PLAN_PRODUCT_ID) return false;
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
  if (offer.productId !== PLAN_PRODUCT_ID || offer.nativePlanIap !== true) {
    return { mode: "paywall", offer: fallbackPlanOffer() };
  }
  if (offerIsEntitled(offer, args.now)) return { mode: "unlocked", offer };
  return { mode: "paywall", offer };
}

export function planPriceLabel(offer?: Partial<PlanOffer> | null): string {
  const raw = offer?.displayPrice?.trim();
  if (!raw) return PLAN_PRICE_LABEL;
  if (raw.includes("/")) return raw;
  const unit = (offer?.periodUnit ?? "month").toLowerCase();
  const value = offer?.periodValue ?? 1;
  if (value === 1 && (unit === "month" || unit === "year" || unit === "week" || unit === "day")) {
    return `${raw}/${unit}`;
  }
  return raw;
}

export function planTrialLine(offer?: Partial<PlanOffer> | null): string {
  const price = planPriceLabel(offer);
  if (offer?.introPaymentMode && offer.introPaymentMode !== "freeTrial") return price;
  const count = offer?.introPeriodValue ?? 1;
  const unit = (offer?.introPeriodUnit ?? "month").toLowerCase();
  if (count === 1) return `1-${unit} free trial, then ${price}`;
  return `${count}-${unit} free trial, then ${price}`;
}

export function planSubscribeLabel(offer: PlanOffer): string {
  const price = planPriceLabel(offer);
  if (offer.status === "expired") return `Subscribe — ${price}`;
  return "Start 1-month free trial";
}

export function planPaywallCopy(offer?: Partial<PlanOffer> | null) {
  return {
    title: PLAN_TITLE,
    length: PLAN_PERIOD_LABEL,
    price: planPriceLabel(offer),
    trial: planTrialLine(offer),
    includes: PLAN_INCLUDES,
    autoRenew: PLAN_AUTORENEW_TERMS,
    termsUrl: PLAN_TERMS_URL,
    subscribeLabel: planSubscribeLabel({ ...fallbackPlanOffer(), ...offer, status: offer?.status ?? "none" }),
    restoreLabel: "Restore Purchases",
  };
}

export function planPaywallDiscouragesPurchase(text: string): boolean {
  return DISCOURAGED_PAYWALL_NOTES.some((pattern) => pattern.test(text));
}

export function planPaywallText(): string {
  const copy = planPaywallCopy(fallbackPlanOffer());
  return [copy.title, copy.length, copy.trial, copy.price, ...copy.includes, copy.autoRenew, copy.subscribeLabel].join(
    "\n",
  );
}
