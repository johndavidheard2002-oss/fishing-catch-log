import { afterEach, describe, expect, it } from "vitest";
import {
  isNativeIosApp,
  pluginResultToClaim,
  purchaseYearlySubscription,
  restoreYearlySubscription,
  setNativeRuntimeForTests,
  setTideMarkStoreForTests,
  storekitPurchaseAvailable,
} from "./native-iap";

describe("Capacitor StoreKit gate", () => {
  afterEach(() => {
    setNativeRuntimeForTests(null);
    setTideMarkStoreForTests(null);
  });

  it("enables purchase only inside the native iOS shell", () => {
    expect(storekitPurchaseAvailable({ isNativePlatform: () => false, getPlatform: () => "web" })).toBe(false);
    expect(isNativeIosApp({ isNativePlatform: () => true, getPlatform: () => "android" })).toBe(false);
    expect(storekitPurchaseAvailable({ isNativePlatform: () => true, getPlatform: () => "ios" })).toBe(true);
  });

  it("maps a plugin purchase and rejects an empty restore", () => {
    const purchase = pluginResultToClaim(
      {
        productId: "tidemark_premium_yearly",
        transactionId: "100",
        originalTransactionId: "99",
        expiresAt: "2027-09-05T00:00:00.000Z",
      },
      "purchase",
    );
    expect(purchase.ok).toBe(true);
    if (purchase.ok) {
      expect(purchase.claim.source).toBe("purchase");
      expect(purchase.claim.transactionId).toBe("100");
    }
    const empty = pluginResultToClaim({ restored: false, productId: "tidemark_premium_yearly" }, "restore");
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error).toMatch(/No App Store subscription/);
  });

  it("refuses StoreKit calls on web and purchases through the injected native bridge", async () => {
    setNativeRuntimeForTests({ isNativePlatform: () => false, getPlatform: () => "web" });
    await expect(purchaseYearlySubscription()).rejects.toThrow(/Tide Mark iOS app/);

    setNativeRuntimeForTests({ isNativePlatform: () => true, getPlatform: () => "ios" });
    setTideMarkStoreForTests({
      getProduct: async () => ({
        productId: "tidemark_premium_yearly",
        displayPrice: "$39.99",
        displayName: "Tide Mark Premium",
      }),
      purchase: async () => ({
        productId: "tidemark_premium_yearly",
        transactionId: "txn-ios",
        originalTransactionId: "orig-ios",
        expiresAt: "2027-01-01T00:00:00.000Z",
      }),
      restore: async () => ({
        productId: "tidemark_premium_yearly",
        transactionId: "txn-ios",
        originalTransactionId: "orig-ios",
        expiresAt: "2027-01-01T00:00:00.000Z",
        restored: true,
      }),
    });
    const bought = await purchaseYearlySubscription();
    expect(bought.productId).toBe("tidemark_premium_yearly");
    expect(bought.transactionId).toBe("txn-ios");
    const restored = await restoreYearlySubscription();
    expect(restored.source).toBe("restore");
    expect(restored.transactionId).toBe("txn-ios");
  });
});
