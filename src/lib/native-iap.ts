import { Capacitor, registerPlugin, WebPlugin } from "@capacitor/core";
import type { EntitlementSnapshot } from "./entitlement";
import {
  PLAN_PRODUCT_ID,
  fallbackPlanOffer,
  planAccessFromProbe,
  planIapBuildAvailable,
  planOfferFromPlugin,
  userAgentHasPlanIap,
  type PlanAccess,
  type PlanOffer,
} from "./plan-iap";
import {
  parseStorekitClaim,
  type StorekitClaim,
  type StorekitSource,
} from "./storekit";

export const ENTITLEMENT_CHANGED_EVENT = "tidemark-entitlement-changed";

export type PluginHeaderEntry = { name?: string } | string;

export type NativeRuntime = {
  isNativePlatform: () => boolean;
  getPlatform: () => string;
  isPluginAvailable?: (name: string) => boolean;
  PluginHeaders?: PluginHeaderEntry[] | null;
};

export type PlanIapDiagnostics = {
  nativeIos: boolean;
  userAgentMatch: boolean;
  pluginAvailable: boolean;
  pluginHeader: boolean;
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

const TIDE_MARK_STORE_PLUGIN = "TideMarkStore";

const TideMarkStore = registerPlugin<TideMarkStorePlugin>(TIDE_MARK_STORE_PLUGIN, {
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

function pluginHeaderHasTideMarkStore(headers: NativeRuntime["PluginHeaders"]): boolean {
  if (!Array.isArray(headers)) return false;
  return headers.some((entry) => {
    if (typeof entry === "string") return entry === TIDE_MARK_STORE_PLUGIN;
    return entry?.name === TIDE_MARK_STORE_PLUGIN;
  });
}

function windowCapacitor(): NativeRuntime | null {
  if (typeof window === "undefined") return null;
  const cap = (window as Window & { Capacitor?: NativeRuntime }).Capacitor;
  if (!cap || typeof cap.isNativePlatform !== "function" || typeof cap.getPlatform !== "function") {
    return null;
  }
  return cap;
}

/**
 * TideMarkStore on this Capacitor object. `isPluginAvailable` is only counted
 * on native iOS: the website registers a web stub, so the same call is true
 * in Safari and must not open the paywall. PluginHeaders are injected by the
 * native bridge and are never set by that stub.
 */
export function tideMarkStoreProbe(cap: NativeRuntime | null = runtime()): {
  available: boolean;
  header: boolean;
} {
  const sources = [cap, windowCapacitor()].filter((source): source is NativeRuntime => source != null);
  let available = false;
  let header = false;
  for (const source of sources) {
    if (!isNativeIosApp(source)) continue;
    if (pluginHeaderHasTideMarkStore(source.PluginHeaders)) header = true;
    if (typeof source.isPluginAvailable !== "function") continue;
    try {
      if (source.isPluginAvailable(TIDE_MARK_STORE_PLUGIN) === true) available = true;
    } catch {
      // A broken bridge is not a 2.0 plugin.
    }
  }
  return { available, header };
}

/** Native iOS shell, including the live 1.0 build. Not enough to sell Plan. */
export function storekitPurchaseAvailable(cap: NativeRuntime = runtime()): boolean {
  return isNativeIosApp(cap);
}

/**
 * 2.0 iOS shell, including iPad. Native iOS, plus the user-agent token or the
 * TideMarkStore plugin (method or PluginHeaders). Website and 1.0 stay false.
 */
export function planStorekitAvailable(
  cap: NativeRuntime = runtime(),
  ua: string = userAgent(),
): boolean {
  const probe = tideMarkStoreProbe(cap);
  return planIapBuildAvailable({
    nativeIos: isNativeIosApp(cap),
    userAgent: ua,
    pluginAvailable: probe.available,
    pluginHeader: probe.header,
  });
}

export function planIapDiagnostics(
  cap: NativeRuntime = runtime(),
  ua: string = userAgent(),
): PlanIapDiagnostics {
  const probe = tideMarkStoreProbe(cap);
  return {
    nativeIos: isNativeIosApp(cap),
    userAgentMatch: userAgentHasPlanIap(ua),
    pluginAvailable: probe.available,
    pluginHeader: probe.header,
  };
}

export function formatPlanIapDiagnostics(flags: PlanIapDiagnostics): string {
  const plugin = flags.pluginAvailable || flags.pluginHeader ? "yes" : "no";
  return `native=${flags.nativeIos ? "ios" : "no"} ua=${flags.userAgentMatch ? "yes" : "no"} plugin=${plugin}`;
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
    throw new Error("StoreKit Plan is only available in Tide Mark 2.0 on iOS.");
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
    throw new Error("StoreKit Plan is only available in Tide Mark 2.0 on iOS.");
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
    throw new Error("StoreKit Plan is only available in Tide Mark 2.0 on iOS.");
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
