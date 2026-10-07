import { Capacitor, registerPlugin, WebPlugin } from "@capacitor/core";
import type { EntitlementSnapshot } from "./entitlement";
import {
  PLAN_PRODUCT_ID,
  fallbackPlanOffer,
  planAccessFromProbe,
  planIapBuildAvailable,
  planOfferFromPlugin,
  type PlanAccess,
  type PlanOffer,
} from "./plan-iap";
import {
  parseStorekitClaim,
  type StorekitClaim,
  type StorekitSource,
} from "./storekit";

export const ENTITLEMENT_CHANGED_EVENT = "tidemark-entitlement-changed";

export type NativeRuntime = {
  isNativePlatform: () => boolean;
  getPlatform: () => string;
};

export type StorekitProductInfo = {
  productId: string;
  displayPrice: string | null;
  displayName: string | null;
};

export type StorekitPluginResult = {
  nativePlanIap?: boolean;
  productId?: string;
  transactionId?: string;
  originalTransactionId?: string;
  expiresAt?: string | null;
  expiresDate?: string | number | null;
  restored?: boolean;
  entitled?: boolean;
  status?: string;
  jws?: string;
  displayPrice?: string | null;
  displayName?: string | null;
  periodUnit?: string | null;
  periodValue?: number | null;
  introPaymentMode?: string | null;
  introPeriodUnit?: string | null;
  introPeriodValue?: number | null;
  introDisplayPrice?: string | null;
};

export interface TideMarkStorePlugin {
  getProduct(options?: { productId?: string }): Promise<StorekitProductInfo>;
  planOffer(options?: { productId?: string }): Promise<StorekitPluginResult>;
  purchase(options?: { productId?: string }): Promise<StorekitPluginResult>;
  restore(options?: { productId?: string }): Promise<StorekitPluginResult>;
}

class TideMarkStoreWeb extends WebPlugin implements TideMarkStorePlugin {
  async getProduct(): Promise<StorekitProductInfo> {
    throw this.unavailable("StoreKit is only available in the Tide Mark iOS app.");
  }
  async planOffer(): Promise<StorekitPluginResult> {
    throw this.unavailable("StoreKit is only available in the Tide Mark iOS app.");
  }
  async purchase(): Promise<StorekitPluginResult> {
    throw this.unavailable("StoreKit is only available in the Tide Mark iOS app.");
  }
  async restore(): Promise<StorekitPluginResult> {
    throw this.unavailable("StoreKit is only available in the Tide Mark iOS app.");
  }
}

const TideMarkStore = registerPlugin<TideMarkStorePlugin>("TideMarkStore", {
  web: () => new TideMarkStoreWeb(),
});

let runtimeOverride: NativeRuntime | null = null;
let storeOverride: TideMarkStorePlugin | null = null;
let userAgentOverride: string | null = null;

export function setNativeRuntimeForTests(runtime: NativeRuntime | null) {
  runtimeOverride = runtime;
}

export function setTideMarkStoreForTests(store: TideMarkStorePlugin | null) {
  storeOverride = store;
}

export function setUserAgentForTests(userAgent: string | null) {
  userAgentOverride = userAgent;
}

function runtime(): NativeRuntime {
  return runtimeOverride ?? Capacitor;
}

function store(): TideMarkStorePlugin {
  return storeOverride ?? TideMarkStore;
}

function userAgent(): string {
  if (userAgentOverride != null) return userAgentOverride;
  return typeof navigator === "undefined" ? "" : navigator.userAgent;
}

export function isNativeIosApp(cap: NativeRuntime = runtime()): boolean {
  try {
    return cap.isNativePlatform() && cap.getPlatform() === "ios";
  } catch {
    return false;
  }
}

/** Native iOS shell, including the live 1.0 build. Not enough to sell Plan. */
export function storekitPurchaseAvailable(cap: NativeRuntime = runtime()): boolean {
  return isNativeIosApp(cap);
}

/** True only for the 2.0 binary that advertises StoreKit Plan in its user agent. */
export function planStorekitAvailable(
  cap: NativeRuntime = runtime(),
  ua: string = userAgent(),
): boolean {
  return planIapBuildAvailable({ nativeIos: isNativeIosApp(cap), userAgent: ua });
}

export function notifyEntitlementChanged(entitlement?: EntitlementSnapshot | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ENTITLEMENT_CHANGED_EVENT, { detail: entitlement ?? null }));
}

export function pluginResultToClaim(
  result: StorekitPluginResult,
  source: StorekitSource,
  now = new Date(),
): { ok: true; claim: StorekitClaim } | { ok: false; error: string } {
  if (result.restored === false && source === "restore" && result.entitled !== true) {
    if (result.status === "expired") {
      return { ok: false, error: "That Plan subscription has ended." };
    }
    return { ok: false, error: "No App Store subscription to restore for this Apple ID." };
  }
  return parseStorekitClaim(
    {
      productId: result.productId ?? PLAN_PRODUCT_ID,
      transactionId: result.transactionId,
      originalTransactionId: result.originalTransactionId,
      expiresAt: result.expiresAt ?? result.expiresDate,
      jws: result.jws,
      source,
    },
    now,
  );
}

function offerFromResult(result: StorekitPluginResult): PlanOffer {
  return (
    planOfferFromPlugin({
      ...result,
      nativePlanIap: true,
      productId: result.productId ?? PLAN_PRODUCT_ID,
    }) ?? fallbackPlanOffer()
  );
}

export async function fetchPlanOffer(): Promise<PlanOffer> {
  if (!planStorekitAvailable()) {
    throw new Error("StoreKit Plan is only available in Tide Mark 2.0 on iPhone.");
  }
  const result = await store().planOffer({ productId: PLAN_PRODUCT_ID });
  const offer = planOfferFromPlugin(result);
  if (!offer) throw new Error("StoreKit Plan is not available in this app build.");
  return offer;
}

export async function resolvePlanAccess(): Promise<PlanAccess> {
  if (!planStorekitAvailable()) return { mode: "free" };
  try {
    const offer = await fetchPlanOffer();
    return planAccessFromProbe({ nativeBuild: true, offer });
  } catch {
    return planAccessFromProbe({ nativeBuild: true, offer: null });
  }
}

async function persistPlanClaim(claim: StorekitClaim): Promise<EntitlementSnapshot | null> {
  try {
    return await activateStorekitOnServer(claim);
  } catch {
    return null;
  }
}

export async function purchasePlan(): Promise<PlanOffer> {
  if (!planStorekitAvailable()) {
    throw new Error("StoreKit Plan is only available in Tide Mark 2.0 on iPhone.");
  }
  const result = await store().purchase({ productId: PLAN_PRODUCT_ID });
  const parsed = pluginResultToClaim(result, "purchase");
  if (!parsed.ok) throw new Error(parsed.error);
  const offer = offerFromResult(result);
  await persistPlanClaim(parsed.claim);
  if (!offer.entitled || offer.status === "expired") {
    throw new Error("The App Store subscription is not active.");
  }
  return offer;
}

export async function restorePlan(): Promise<PlanOffer> {
  if (!planStorekitAvailable()) {
    throw new Error("StoreKit Plan is only available in Tide Mark 2.0 on iPhone.");
  }
  const result = await store().restore({ productId: PLAN_PRODUCT_ID });
  const offer = offerFromResult(result);
  const parsed = pluginResultToClaim(result, "restore");
  if (parsed.ok) {
    await persistPlanClaim(parsed.claim);
  } else if (offer.transactionId && offer.status === "expired") {
    const expired = parseStorekitClaim({
      productId: offer.productId,
      transactionId: offer.transactionId,
      originalTransactionId: offer.originalTransactionId,
      expiresAt: offer.expiresAt,
      source: "restore",
    });
    if (expired.ok) await persistPlanClaim(expired.claim);
  }
  if (!parsed.ok) throw new Error(parsed.error);
  if (!offer.entitled || offer.status === "expired") {
    throw new Error(
      offer.status === "expired"
        ? "That Plan subscription has ended."
        : "No App Store subscription to restore for this Apple ID.",
    );
  }
  return offer;
}

export async function activateStorekitOnServer(claim: StorekitClaim): Promise<EntitlementSnapshot> {
  const response = await fetch("/api/entitlement/storekit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      productId: claim.productId,
      transactionId: claim.transactionId,
      originalTransactionId: claim.originalTransactionId,
      expiresAt: claim.expiresAt,
      source: claim.source,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    entitlement?: EntitlementSnapshot;
  };
  if (!response.ok || !data.entitlement) {
    throw new Error(typeof data.error === "string" ? data.error : "Could not save the App Store subscription.");
  }
  notifyEntitlementChanged(data.entitlement);
  return data.entitlement;
}

/** Dormant journal paywall. 1.0 keeps this hidden. Purchases the Plan product if it is ever shown in 2.0. */
export async function purchaseAndActivateYearly(): Promise<EntitlementSnapshot> {
  const offer = await purchasePlan();
  const parsed = parseStorekitClaim({
    productId: offer.productId,
    transactionId: offer.transactionId,
    originalTransactionId: offer.originalTransactionId,
    expiresAt: offer.expiresAt,
    source: "purchase",
  });
  if (!parsed.ok || !parsed.claim.transactionId) {
    throw new Error("Could not save the App Store subscription.");
  }
  const saved = await activateStorekitOnServer(parsed.claim);
  return saved;
}

export async function restoreAndActivateYearly(): Promise<EntitlementSnapshot> {
  const offer = await restorePlan();
  const parsed = parseStorekitClaim({
    productId: offer.productId,
    transactionId: offer.transactionId,
    originalTransactionId: offer.originalTransactionId,
    expiresAt: offer.expiresAt,
    source: "restore",
  });
  if (!parsed.ok) throw new Error(parsed.error);
  return activateStorekitOnServer(parsed.claim);
}
