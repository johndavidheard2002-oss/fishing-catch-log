import { Capacitor, registerPlugin, WebPlugin } from "@capacitor/core";
import type { EntitlementSnapshot } from "./entitlement";
import {
  STOREKIT_YEARLY_PRODUCT_ID,
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
  productId?: string;
  transactionId?: string;
  originalTransactionId?: string;
  expiresAt?: string | null;
  expiresDate?: string | number | null;
  restored?: boolean;
  jws?: string;
};

export interface TideMarkStorePlugin {
  getProduct(options?: { productId?: string }): Promise<StorekitProductInfo>;
  purchase(options?: { productId?: string }): Promise<StorekitPluginResult>;
  restore(options?: { productId?: string }): Promise<StorekitPluginResult>;
}

class TideMarkStoreWeb extends WebPlugin implements TideMarkStorePlugin {
  async getProduct(): Promise<StorekitProductInfo> {
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

export function setNativeRuntimeForTests(runtime: NativeRuntime | null) {
  runtimeOverride = runtime;
}

export function setTideMarkStoreForTests(store: TideMarkStorePlugin | null) {
  storeOverride = store;
}

function runtime(): NativeRuntime {
  return runtimeOverride ?? Capacitor;
}

function store(): TideMarkStorePlugin {
  return storeOverride ?? TideMarkStore;
}

export function isNativeIosApp(cap: NativeRuntime = runtime()): boolean {
  try {
    return cap.isNativePlatform() && cap.getPlatform() === "ios";
  } catch {
    return false;
  }
}

/** StoreKit buy/restore is only offered inside the Capacitor iOS shell. */
export function storekitPurchaseAvailable(cap: NativeRuntime = runtime()): boolean {
  return isNativeIosApp(cap);
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
  if (result.restored === false && source === "restore") {
    return { ok: false, error: "No App Store subscription to restore for this Apple ID." };
  }
  return parseStorekitClaim(
    {
      productId: result.productId ?? STOREKIT_YEARLY_PRODUCT_ID,
      transactionId: result.transactionId,
      originalTransactionId: result.originalTransactionId,
      expiresAt: result.expiresAt ?? result.expiresDate,
      jws: result.jws,
      source,
    },
    now,
  );
}

export async function fetchStorekitProduct(): Promise<StorekitProductInfo> {
  if (!storekitPurchaseAvailable()) {
    throw new Error("StoreKit is only available in the Tide Mark iOS app.");
  }
  const product = await store().getProduct({ productId: STOREKIT_YEARLY_PRODUCT_ID });
  if (product.productId && product.productId !== STOREKIT_YEARLY_PRODUCT_ID) {
    throw new Error(`StoreKit product must be ${STOREKIT_YEARLY_PRODUCT_ID}.`);
  }
  return {
    productId: STOREKIT_YEARLY_PRODUCT_ID,
    displayPrice: product.displayPrice ?? null,
    displayName: product.displayName ?? null,
  };
}

export async function purchaseYearlySubscription(): Promise<StorekitClaim> {
  if (!storekitPurchaseAvailable()) {
    throw new Error("StoreKit is only available in the Tide Mark iOS app.");
  }
  const result = await store().purchase({ productId: STOREKIT_YEARLY_PRODUCT_ID });
  const parsed = pluginResultToClaim(result, "purchase");
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.claim;
}

export async function restoreYearlySubscription(): Promise<StorekitClaim> {
  if (!storekitPurchaseAvailable()) {
    throw new Error("StoreKit is only available in the Tide Mark iOS app.");
  }
  const result = await store().restore({ productId: STOREKIT_YEARLY_PRODUCT_ID });
  const parsed = pluginResultToClaim(result, "restore");
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.claim;
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
    throw new Error(typeof data.error === "string" ? data.error : "Could not unlock the journal from the App Store.");
  }
  notifyEntitlementChanged(data.entitlement);
  return data.entitlement;
}

export async function purchaseAndActivateYearly(): Promise<EntitlementSnapshot> {
  const claim = await purchaseYearlySubscription();
  return activateStorekitOnServer(claim);
}

export async function restoreAndActivateYearly(): Promise<EntitlementSnapshot> {
  const claim = await restoreYearlySubscription();
  return activateStorekitOnServer(claim);
}
