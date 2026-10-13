import { afterEach, describe, expect, it } from "vitest";
import { PLAN_BUILD_UA_TOKEN, PLAN_LEGACY_MONTHLY_PRODUCT_ID, PLAN_PRODUCT_ID, PLAN_UA_TOKEN } from "./plan-iap";
import {
  formatPlanIapDiagnostics,
  isNativeIosApp,
  planIapDiagnostics,
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
const ipadDesktopUa = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)";
const capableUa = `Mozilla/5.0 ${PLAN_UA_TOKEN} ${PLAN_BUILD_UA_TOKEN}`;
const olderUa = `Mozilla/5.0 ${PLAN_UA_TOKEN}`;

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
    expect(planStorekitAvailable(ios, olderUa)).toBe(false);
    expect(planStorekitAvailable({ ...ios, PluginHeaders: [{ name: "TideMarkStore" }] }, olderUa)).toBe(false);
    expect(planStorekitAvailable({ ...ios, isPluginAvailable: () => false, PluginHeaders: [] }, capableUa)).toBe(
      false,
    );
    expect(
      planStorekitAvailable({ ...ios, isPluginAvailable: (name) => name === "TideMarkStore" }, capableUa),
    ).toBe(true);
    expect(
      planStorekitAvailable({ ...ios, PluginHeaders: [{ name: "TideMarkStore" }] }, capableUa),
    ).toBe(true);
    expect(planStorekitAvailable({ ...ios, isPluginAvailable: () => false, PluginHeaders: [] }, ipadDesktopUa)).toBe(
      false,
    );
    const website = {
      isNativePlatform: () => false,
      getPlatform: () => "web",
      isPluginAvailable: () => true,
    };
    expect(planStorekitAvailable(website, "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe(false);
    expect(planStorekitAvailable(website, capableUa)).toBe(false);
    expect(planStorekitAvailable(website, olderUa)).toBe(false);
    expect(
      planStorekitAvailable(
        { ...website, PluginHeaders: [{ name: "TideMarkStore" }] },
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      ),
    ).toBe(false);
    expect(
      planStorekitAvailable(
        { ...website, PluginHeaders: [{ name: "TideMarkStore" }] },
        capableUa,
      ),
    ).toBe(true);
    expect(formatPlanIapDiagnostics(planIapDiagnostics(ios, ipadDesktopUa))).toBe(
      "native=ios ua=no plugin=no bridge=no",
    );
    expect(
      formatPlanIapDiagnostics(
        planIapDiagnostics({ ...ios, isPluginAvailable: () => true }, ipadDesktopUa),
      ),
    ).toBe("native=ios ua=no plugin=yes bridge=no");
    expect(
      formatPlanIapDiagnostics(
        planIapDiagnostics({ ...ios, PluginHeaders: [{ name: "TideMarkStore" }] }, ipadDesktopUa),
      ),
    ).toBe("native=ios ua=no plugin=yes bridge=no");
    expect(formatPlanIapDiagnostics(planIapDiagnostics(website, olderUa))).toBe(
      "native=no ua=no plugin=no bridge=no",
    );
    expect(formatPlanIapDiagnostics(planIapDiagnostics(website, capableUa))).toBe(
      "native=no ua=yes plugin=no bridge=no",
    );
  });

  it("keeps Plan free on iPad when the shell does not report build 14", async () => {
    setNativeRuntimeForTests({
      ...ios,
      isPluginAvailable: (name) => name === "TideMarkStore",
      PluginHeaders: [{ name: "TideMarkStore" }],
    });
    setUserAgentForTests(ipadDesktopUa);
    setTideMarkStoreForTests({
      getProduct: async () => ({ productId: PLAN_PRODUCT_ID, displayPrice: "$19.99", displayName: "Tide Mark Plan" }),
      planOffer: async () => ({
        nativePlanIap: true,
        productId: PLAN_PRODUCT_ID,
        displayPrice: "$19.99",
        entitled: false,
        status: "none",
      }),
      purchase: async () => {
        throw new Error("purchase should not run");
      },
      restore: async () => {
        throw new Error("restore should not run");
      },
    });
    const access = await resolvePlanAccess();
    expect(access.mode).toBe("free");
  });

  it("opens the paywall when build 14 reports TideMarkStore purchase", async () => {
    setNativeRuntimeForTests({
      ...ios,
      isPluginAvailable: (name) => name === "TideMarkStore",
      PluginHeaders: [{ name: "TideMarkStore" }],
    });
    setUserAgentForTests(capableUa);
    setTideMarkStoreForTests({
      getProduct: async () => ({ productId: PLAN_PRODUCT_ID, displayPrice: "$19.99", displayName: "Tide Mark Plan" }),
      planOffer: async () => ({
        nativePlanIap: true,
        productId: PLAN_PRODUCT_ID,
        displayPrice: "$19.99",
        entitled: false,
        status: "none",
      }),
      purchase: async () => {
        throw new Error("purchase should not run");
      },
      restore: async () => {
        throw new Error("restore should not run");
      },
    });
    const access = await resolvePlanAccess();
    expect(access.mode).toBe("paywall");
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
    const monthly = pluginResultToClaim(
      {
        productId: PLAN_LEGACY_MONTHLY_PRODUCT_ID,
        transactionId: "txn-monthly",
        expiresAt: "2027-01-01T00:00:00.000Z",
        entitled: true,
        restored: true,
      },
      "restore",
    );
    expect(monthly.ok).toBe(true);
    if (monthly.ok) expect(monthly.claim.productId).toBe(PLAN_LEGACY_MONTHLY_PRODUCT_ID);
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

  it("refuses StoreKit calls on the plain website and purchases through the 2.0 bridge", async () => {
    setNativeRuntimeForTests({ isNativePlatform: () => false, getPlatform: () => "web" });
    setUserAgentForTests("Mozilla/5.0");
    await expect(purchasePlan()).rejects.toThrow(/Tide Mark 2\.0/);
    expect(planStorekitAvailable()).toBe(false);

    setUserAgentForTests(olderUa);
    expect(planStorekitAvailable()).toBe(false);
    setUserAgentForTests(capableUa);
    expect(planStorekitAvailable()).toBe(false);

    setNativeRuntimeForTests({
      ...ios,
      isPluginAvailable: (name) => name === "TideMarkStore",
      PluginHeaders: [{ name: "TideMarkStore" }],
    });
    setUserAgentForTests(capableUa);
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
