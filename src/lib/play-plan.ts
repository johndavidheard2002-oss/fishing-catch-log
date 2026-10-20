import { DAY_MS, addMs } from "./entitlement";
import {
  PLAY_PACKAGE_NAME,
  PLAY_PLAN_BASE_PLAN_ID,
  PLAY_PLAN_OFFER_ID,
  PLAY_PLAN_PRODUCT_ID,
} from "./native-app";

export const PLAY_PRODUCT_ID = PLAY_PLAN_PRODUCT_ID;
export const PLAY_BASE_PLAN_ID = PLAY_PLAN_BASE_PLAN_ID;
export const PLAY_OFFER_ID = PLAY_PLAN_OFFER_ID;
export const PLAY_APPLICATION_ID = PLAY_PACKAGE_NAME;
/** Used only when Play does not return an expiry and server verification is off. */
export const PLAY_UNVERIFIED_TERM_MS = 365 * DAY_MS;

export const PLAY_SOURCES = ["purchase", "restore"] as const;
export type PlaySource = (typeof PLAY_SOURCES)[number];

export type PlayClaim = {
  productId: typeof PLAY_PRODUCT_ID;
  purchaseToken: string;
  orderId: string | null;
  basePlanId: string | null;
  offerId: string | null;
  expiresAt: string | null;
  source: PlaySource;
};

export type PlayEntitlement = {
  status: "active" | "expired";
  expiresAt: string | null;
};

const ENTITLED_STATES = new Set([
  "SUBSCRIPTION_STATE_ACTIVE",
  "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
  "SUBSCRIPTION_STATE_CANCELED",
]);

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asIsoDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function isPlaySource(value: unknown): value is PlaySource {
  return typeof value === "string" && (PLAY_SOURCES as readonly string[]).includes(value);
}

export function parsePlayClaim(
  body: unknown,
): { ok: true; claim: PlayClaim } | { ok: false; error: string } {
  const raw = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!raw) return { ok: false, error: "Google Play purchase is required." };

  const productId = asNonEmptyString(raw.productId) ?? PLAY_PRODUCT_ID;
  if (productId !== PLAY_PRODUCT_ID) {
    return { ok: false, error: `productId must be ${PLAY_PRODUCT_ID}.` };
  }

  const source = raw.source ?? "purchase";
  if (!isPlaySource(source)) {
    return { ok: false, error: "source must be purchase or restore." };
  }

  const purchaseToken = asNonEmptyString(raw.purchaseToken);
  if (!purchaseToken) {
    return { ok: false, error: "purchaseToken is required." };
  }

  const basePlanId = asNonEmptyString(raw.basePlanId);
  if (basePlanId && basePlanId !== PLAY_BASE_PLAN_ID) {
    return { ok: false, error: `basePlanId must be ${PLAY_BASE_PLAN_ID}.` };
  }

  return {
    ok: true,
    claim: {
      productId: PLAY_PRODUCT_ID,
      purchaseToken,
      orderId: asNonEmptyString(raw.orderId) ?? asNonEmptyString(raw.transactionId),
      basePlanId,
      offerId: asNonEmptyString(raw.offerId),
      expiresAt: asIsoDate(raw.expiresAt ?? raw.expiresDate),
      source,
    },
  };
}

/**
 * Map a purchases.subscriptionsv2 resource to a Tide Mark entitlement.
 * A canceled subscription stays active until expiryTime.
 */
export function entitlementFromPlaySubscription(
  body: unknown,
  now = new Date(),
): { ok: true; entitlement: PlayEntitlement } | { ok: false; error: string } {
  const raw = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!raw) return { ok: false, error: "Google Play subscription could not be read." };

  const state = asNonEmptyString(raw.subscriptionState);
  const lineItems = Array.isArray(raw.lineItems) ? raw.lineItems : [];
  const match = lineItems.find((item) => {
    if (!item || typeof item !== "object") return false;
    return (item as Record<string, unknown>).productId === PLAY_PRODUCT_ID;
  }) as Record<string, unknown> | undefined;

  if (!match) {
    return { ok: false, error: `Google Play subscription is not ${PLAY_PRODUCT_ID}.` };
  }

  const offerDetails =
    match.offerDetails && typeof match.offerDetails === "object"
      ? (match.offerDetails as Record<string, unknown>)
      : null;
  const basePlanId = asNonEmptyString(offerDetails?.basePlanId);
  if (basePlanId && basePlanId !== PLAY_BASE_PLAN_ID) {
    return { ok: false, error: `basePlanId must be ${PLAY_BASE_PLAN_ID}.` };
  }

  const expiresAt = asIsoDate(match.expiryTime);
  const expired = expiresAt != null && new Date(expiresAt).getTime() <= now.getTime();

  if (state === "SUBSCRIPTION_STATE_PENDING" || state === "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED") {
    return { ok: false, error: "Purchase is pending approval." };
  }
  if (state === "SUBSCRIPTION_STATE_PAUSED") {
    return { ok: false, error: "That Plan subscription is paused in Google Play." };
  }
  if (state === "SUBSCRIPTION_STATE_ON_HOLD") {
    return { ok: false, error: "That Plan subscription is on hold in Google Play." };
  }
  if (state === "SUBSCRIPTION_STATE_EXPIRED" || expired || !state || !ENTITLED_STATES.has(state)) {
    return { ok: true, entitlement: { status: "expired", expiresAt } };
  }
  return { ok: true, entitlement: { status: "active", expiresAt } };
}

/** Device-trusted term used only when the Play Developer API credentials are unset. */
export function unverifiedPlayEntitlement(claim: PlayClaim, now = new Date()): PlayEntitlement {
  if (claim.expiresAt) {
    const expired = new Date(claim.expiresAt).getTime() <= now.getTime();
    return { status: expired ? "expired" : "active", expiresAt: claim.expiresAt };
  }
  return {
    status: "active",
    expiresAt: addMs(now.toISOString(), PLAY_UNVERIFIED_TERM_MS),
  };
}
