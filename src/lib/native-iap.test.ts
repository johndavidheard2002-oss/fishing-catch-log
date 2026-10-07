import { afterEach, describe, expect, it } from "vitest";
import { PLAN_PRODUCT_ID, PLAN_UA_TOKEN } from "./plan-iap";
import {
  isNativeIosApp,
  planStorekitAvailable,
  pluginResultToClaim,
  purchasePlan,
  restorePlan,
  resolvePlanAccess,
  setNativeRuntimeForTests,
  setTideMarkStoreForTests,
  setUserAgentForTests,
  storekitPurchaseAvailable,
} from "./native-iap";

const ios = { isNativePlatform: () => true, getPlatform: () => "ios" };

describe("Capacitor StoreKit gate", () => {
  afterEach(() => {
    setNativeRuntimeForTests(null);
    setTideMarkStoreForTests(null);
    setUserAgentForTests(null);
  });

  it("enables the old native check on any iOS shell and Plan only on 2.0", () => {
    expect(storekitPurchaseAvailable({ isNativePlatform: () => false, getPlatform: () => "web" })).toBe(false);
    expect(isNativeIosApp({ isNativePlatform: () => true, getPlatform: () => "android" })).toBe(false);
    expect(storekitPurchaseAvailable(ios)).toBe(true);
    expect(planStorekitAvailable(ios, "TideMark/1.0")).toBe(false);
    expect(planStorekitAvailable(ios, `Mozilla ${PLAN_UA_TOKEN}`)).toBe(true);
  });

  it("keeps Plan free when the 2.0 user agent is missing", async () => {
    setNativeRuntimeForTests(ios);
    setUserAgentForTests("TideMark/1.0");
    setTideMarkStoreForTests({
      getProduct: async () => ({ productId: PLAN_PRODUCT_ID, displayPrice: "$19.99", displayName: "Tide Mark Plan" }),
      planOffer: async () => {
        throw new Error("planOffer should not run on 1.0");
      },
      purchase: async () => {
        throw new Error("purchase should not run on 1.0");
      },
      restore: async () => {
        throw new Error("restore should not run on 1.0");
      },
    });
    await expect(resolvePlanAccess()).resolves.toEqual({ mode: "free" });
  });

  it("maps a plugin purchase and rejects an empty or ended restore", () => {
    const purchase = pluginResultToClaim(
      {
        productId: PLAN_PRODUCT_ID,
        transactionId: "100",
        originalTransactionId: "99",
        expiresAt: "2026-11-07T00:00:00.000Z",
        entitled: true,
      },
      "purchase",
    );
    expect(purchase.ok).toBe(true);
    if (purchase.ok) {
      expect(purchase.claim.source).toBe("purchase");
      expect(purchase.claim.transactionId).toBe("100");
    }
    const empty = pluginResultToClaim({ restored: false, productId: PLAN_PRODUCT_ID, status: "none" }, "restore");
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error).toMatch(/No App Store subscription/);
    const ended = pluginResultToClaim(
      { restored: false, productId: PLAN_PRODUCT_ID, status: "expired", entitled: false },
      "restore",
    );
    expect(ended.ok).toBe(false);
    if (!ended.ok) expect(ended.error).toMatch(/ended/);
  });

  it("refuses StoreKit calls on web and purchases through the 2.0 bridge", async () => {
    setNativeRuntimeForTests({ isNativePlatform: () => false, getPlatform: () => "web" });
    setUserAgentForTests(`Mozilla ${PLAN_UA_TOKEN}`);
    await expect(purchasePlan()).rejects.toThrow(/Tide Mark 2\.0/);

    setNativeRuntimeForTests(ios);
    setUserAgentForTests(`Mozilla ${PLAN_UA_TOKEN}`);
    setTideMarkStoreForTests({
      getProduct: async () => ({
        productId: PLAN_PRODUCT_ID,
        displayPrice: "$19.99",
        displayName: "Tide Mark Plan",
      }),
      planOffer: async () => ({
        nativePlanIap: true,
        productId: PLAN_PRODUCT_ID,
        displayPrice: "$19.99",
        entitled: false,
        status: "none",
      }),
      purchase: async () => ({
        nativePlanIap: true,
        productId: PLAN_PRODUCT_ID,
        transactionId: "txn-ios",
        originalTransactionId: "orig-ios",
        expiresAt: "2026-11-07T00:00:00.000Z",
        entitled: true,
        status: "active",
      }),
      restore: async () => ({
        nativePlanIap: true,
        productId: PLAN_PRODUCT_ID,
        transactionId: "txn-ios",
        originalTransactionId: "orig-ios",
        expiresAt: "2026-11-07T00:00:00.000Z",
        entitled: true,
        status: "active",
        restored: true,
      }),
    });
    const access = await resolvePlanAccess();
    expect(access.mode).toBe("paywall");
    const bought = await purchasePlan();
    expect(bought.productId).toBe(PLAN_PRODUCT_ID);
    expect(bought.transactionId).toBe("txn-ios");
    expect(bought.entitled).toBe(true);
    const restored = await restorePlan();
    expect(restored.status).toBe("active");
    expect(restored.transactionId).toBe("txn-ios");
  });
});
