import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PLAN_PRODUCT_ID,
  PLAN_UA_TOKEN,
  fallbackPlanOffer,
  offerIsEntitled,
  planAccessFromProbe,
  planIapBuildAvailable,
  planOfferFromPlugin,
  planPaywallCopy,
  planPaywallDiscouragesPurchase,
  planPaywallText,
  planPriceLabel,
  planTrialLine,
} from "./plan-iap";

describe("Plan StoreKit gate", () => {
  it("sells Plan only in the 2.0 iOS shell", () => {
    expect(planIapBuildAvailable({ nativeIos: false, userAgent: `Mozilla ${PLAN_UA_TOKEN}` })).toBe(false);
    expect(planIapBuildAvailable({ nativeIos: true, userAgent: "TideMark/1.0" })).toBe(false);
    expect(planIapBuildAvailable({ nativeIos: true, userAgent: `Mozilla ${PLAN_UA_TOKEN}` })).toBe(true);
  });

  it("keeps the website and 1.0 on the free Plan", () => {
    expect(planAccessFromProbe({ nativeBuild: false, offer: null }).mode).toBe("free");
    expect(
      planAccessFromProbe({
        nativeBuild: false,
        offer: { ...fallbackPlanOffer(), entitled: false, status: "expired" },
      }).mode,
    ).toBe("free");
  });

  it("locks 2.0 until StoreKit says the subscription is current", () => {
    const now = new Date("2026-10-07T12:00:00.000Z");
    const locked = planAccessFromProbe({ nativeBuild: true, offer: fallbackPlanOffer(), now });
    expect(locked.mode).toBe("paywall");
    const active = planAccessFromProbe({
      nativeBuild: true,
      now,
      offer: {
        ...fallbackPlanOffer(),
        entitled: true,
        status: "active",
        expiresAt: "2026-11-07T12:00:00.000Z",
        displayPrice: "$19.99",
      },
    });
    expect(active.mode).toBe("unlocked");
    const lapsed = planAccessFromProbe({
      nativeBuild: true,
      now,
      offer: {
        ...fallbackPlanOffer(),
        entitled: true,
        status: "active",
        expiresAt: "2026-10-01T12:00:00.000Z",
      },
    });
    expect(lapsed.mode).toBe("paywall");
    expect(offerIsEntitled({ ...fallbackPlanOffer(), entitled: true, status: "expired" }, now)).toBe(false);
  });

  it("reads a localized StoreKit price and ignores a different product", () => {
    expect(planPriceLabel({ displayPrice: "€19,99", periodUnit: "month", periodValue: 1 })).toBe("€19,99/month");
    expect(planPriceLabel(null)).toBe("$19.99/month");
    expect(planTrialLine({ displayPrice: "$19.99", introPaymentMode: "freeTrial", introPeriodUnit: "month", introPeriodValue: 1 })).toBe(
      "1-month free trial, then $19.99/month",
    );
    expect(planOfferFromPlugin({ nativePlanIap: true, productId: "other", entitled: true })).toBeNull();
    const parsed = planOfferFromPlugin({
      nativePlanIap: true,
      productId: PLAN_PRODUCT_ID,
      entitled: true,
      status: "active",
      displayPrice: "$19.99",
      expiresAt: "2026-11-07T00:00:00.000Z",
    });
    expect(parsed?.entitled).toBe(true);
    expect(parsed?.displayPrice).toBe("$19.99");
  });

  it("describes Plan without telling people not to subscribe", () => {
    const copy = planPaywallCopy(fallbackPlanOffer());
    expect(copy.title).toBe("Tide Mark Plan");
    expect(copy.length).toBe("1 month");
    expect(copy.trial).toContain("1-month free trial");
    expect(copy.price).toBe("$19.99/month");
    expect(copy.restoreLabel).toBe("Restore Purchases");
    expect(copy.termsUrl).toContain("apple.com/legal");
    expect(copy.autoRenew.toLowerCase()).toContain("renew");
    expect(copy.includes.join(" ")).toMatch(/same height/i);
    expect(copy.includes.join(" ")).toMatch(/incoming or outgoing/i);
    expect(copy.includes.join(" ")).toMatch(/notes on the plan/i);
    expect(copy.includes.join(" ")).toMatch(/day’s tides/i);
    const text = planPaywallText();
    expect(planPaywallDiscouragesPurchase(text)).toBe(false);
    expect(text.toLowerCase()).not.toMatch(/unless you have|keep using the app free|don['’]t buy/);
    const ui = readFileSync(resolve(process.cwd(), "src/components/PlanPaywall.tsx"), "utf8");
    expect(ui).toContain('data-testid="plan-subscribe"');
    expect(ui).toContain('data-testid="plan-restore"');
    expect(ui).toContain('data-testid="plan-terms"');
    expect(ui).toContain('data-testid="plan-privacy"');
    expect(ui).toContain("PLAN_TERMS_URL");
    expect(planPaywallDiscouragesPurchase(ui)).toBe(false);
    const page = readFileSync(resolve(process.cwd(), "src/app/plan/page.tsx"), "utf8");
    expect(page).toContain("<PlanAccess>");
    const access = readFileSync(resolve(process.cwd(), "src/components/PlanAccess.tsx"), "utf8");
    expect(access).toContain("<PlanSubscribeScreen />");
    expect(access).toContain("{children}");
    const home = readFileSync(resolve(process.cwd(), "src/components/HomeClient.tsx"), "utf8");
    expect(home).toContain('href="/subscribe"');
    expect(home).toContain('data-testid="home-tide-mark-plan"');
    expect(home).toContain("planOfferVisible");
    const subscribe = readFileSync(resolve(process.cwd(), "src/app/subscribe/page.tsx"), "utf8");
    expect(subscribe).toContain("PlanSubscribeScreen");
    expect(ui).toContain('data-testid="plan-price-retry"');
    expect(ui).toContain('data-testid="plan-price-fallback"');
    const dev = readFileSync(resolve(process.cwd(), "src/app/dev/plan-paywall/page.tsx"), "utf8");
    expect(dev).toContain('process.env.NODE_ENV === "production"');
    expect(dev).toContain("notFound");
  });
});
