import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PLAN_LEGACY_MONTHLY_PRODUCT_ID,
  PLAN_LEGACY_YEARLY_PRODUCT_ID,
  PLAN_OFFER_LINE,
  PLAN_PRODUCT_ID,
  PLAN_TRIAL_NOTE,
  PLAN_UA_TOKEN,
  fallbackPlanOffer,
  offerIsEntitled,
  planAccessFromProbe,
  planIapBuildAvailable,
  planOfferFromPlugin,
  planPaywallCopy,
  planPaywallDiscouragesPurchase,
  planDiagnosticsRequested,
  planPaywallText,
  planPriceLabel,
  planStorekitErrorForViewer,
} from "./plan-iap";

describe("Plan StoreKit gate", () => {
  it("sells Plan only in the 2.0 iOS shell", () => {
    expect(planIapBuildAvailable({ nativeIos: false, userAgent: "Mozilla/5.0" })).toBe(false);
    expect(planIapBuildAvailable({ nativeIos: false, userAgent: "Mozilla/5.0", pluginAvailable: true })).toBe(false);
    expect(planIapBuildAvailable({ nativeIos: true, userAgent: "TideMark/1.0" })).toBe(false);
    expect(planIapBuildAvailable({ nativeIos: false, userAgent: `Mozilla ${PLAN_UA_TOKEN}` })).toBe(true);
    expect(planIapBuildAvailable({ nativeIos: true, userAgent: `Mozilla ${PLAN_UA_TOKEN}` })).toBe(true);
    expect(
      planIapBuildAvailable({
        nativeIos: true,
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        pluginAvailable: true,
      }),
    ).toBe(true);
    expect(
      planIapBuildAvailable({
        nativeIos: false,
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        pluginHeader: true,
      }),
    ).toBe(true);
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
    expect(planPriceLabel(null)).toBe("$19.99/year");
    expect(planPriceLabel({ displayPrice: "$19.99" })).toBe("$19.99/year");
    expect(PLAN_OFFER_LINE).toBe("$19.99/year · 1-month free trial");
    expect(PLAN_TRIAL_NOTE).toBe(
      "Try Tide Mark Plan free for 1 month. Cancel anytime before the trial ends and you won't be charged. After the trial, it renews at $19.99/year until canceled.",
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
    const restoredMonthly = planOfferFromPlugin({
      nativePlanIap: true,
      productId: PLAN_LEGACY_MONTHLY_PRODUCT_ID,
      entitled: true,
      status: "active",
      expiresAt: "2027-01-01T00:00:00.000Z",
    });
    expect(restoredMonthly?.productId).toBe(PLAN_LEGACY_MONTHLY_PRODUCT_ID);
    const restoredYearly = planOfferFromPlugin({
      nativePlanIap: true,
      productId: PLAN_LEGACY_YEARLY_PRODUCT_ID,
      entitled: true,
      status: "active",
      expiresAt: "2027-01-01T00:00:00.000Z",
    });
    expect(restoredYearly?.productId).toBe(PLAN_LEGACY_YEARLY_PRODUCT_ID);
    expect(offerIsEntitled(restoredYearly!, new Date("2026-10-12T00:00:00.000Z"))).toBe(true);
    expect(offerIsEntitled(restoredMonthly!, new Date("2026-10-12T00:00:00.000Z"))).toBe(true);
    expect(
      planAccessFromProbe({
        nativeBuild: true,
        offer: restoredMonthly,
        now: new Date("2026-10-12T00:00:00.000Z"),
      }).mode,
    ).toBe("unlocked");
  });

  it("describes Plan without telling people not to subscribe", () => {
    const copy = planPaywallCopy(fallbackPlanOffer());
    expect(copy.title).toBe("Tide Mark Plan");
    expect(copy.length).toBe("1 year");
    expect(copy.price).toBe("$19.99/year");
    expect(copy.trialNote).toBe(
      "Try Tide Mark Plan free for 1 month. Cancel anytime before the trial ends and you won't be charged. After the trial, it renews at $19.99/year until canceled.",
    );
    expect(copy.subscribeLabel).toBe("Subscribe – $19.99/year");
    expect(copy.subscribeLabel.toLowerCase()).not.toContain("trial");
    expect(copy.restoreLabel).toBe("Restore Purchases");
    const localized = planPaywallCopy({ displayPrice: "€19,99", periodUnit: "year", periodValue: 1 });
    expect(localized.price).toBe("€19,99/year");
    expect(localized.subscribeLabel).toBe("Subscribe – €19,99/year");
    expect(planPaywallCopy({ ...fallbackPlanOffer(), status: "expired" }).subscribeLabel).toBe("Subscribe – $19.99/year");
    expect(copy.termsUrl).toContain("apple.com/legal");
    expect(copy.autoRenew.toLowerCase()).toContain("renew");
    expect(copy.autoRenew).toContain("$19.99/year");
    expect(copy.autoRenew).toMatch(/each year/);
    expect(copy.autoRenew).toMatch(/24 hours/);
    expect(copy.includes.join(" ")).toMatch(/same height/i);
    expect(copy.includes.join(" ")).toMatch(/incoming or outgoing/i);
    expect(copy.includes.join(" ")).toMatch(/notes on the plan/i);
    expect(copy.includes.join(" ")).toMatch(/day’s tides/i);
    const text = planPaywallText();
    expect(planPaywallDiscouragesPurchase(text)).toBe(false);
    expect(text).not.toMatch(/free trial, then/i);
    expect(text).not.toMatch(/start 1-month free trial/i);
    expect(text.indexOf(copy.price)).toBeLessThan(text.indexOf(copy.trialNote));
    expect(text.toLowerCase()).not.toMatch(/unless you have|keep using the app free|don['’]t buy/);
    const ui = readFileSync(resolve(process.cwd(), "src/components/PlanPaywall.tsx"), "utf8");
    expect(ui).toContain('data-testid="plan-paywall-price"');
    expect(ui).toContain('data-testid="plan-paywall-trial"');
    expect(ui.indexOf('data-testid="plan-paywall-price"')).toBeLessThan(ui.indexOf('data-testid="plan-paywall-trial"'));
    expect(ui).toContain("text-4xl font-bold leading-none tracking-tight text-ink");
    expect(ui).toContain("text-sm font-normal text-ink-muted");
    expect(ui).toContain("{copy.price}");
    expect(ui).toContain("{copy.trialNote}");
    expect(ui).not.toContain("1-month free trial, then");
    expect(ui).not.toContain("Start 1-month free trial");
    expect(ui).toContain('data-testid="plan-subscribe"');
    expect(ui).toContain('data-testid="plan-restore"');
    expect(ui).toContain('data-testid="plan-terms"');
    expect(ui).toContain('data-testid="plan-privacy"');
    expect(ui).toContain("PLAN_TERMS_URL");
    expect(planPaywallDiscouragesPurchase(ui)).toBe(false);
    const page = readFileSync(resolve(process.cwd(), "src/app/plan/page.tsx"), "utf8");
    expect(page).toContain("<PlanClient");
    expect(page).not.toContain("PlanSubscribeScreen");
    expect(page).not.toContain("PlanAccess");
    expect(page).not.toContain("Paywall");
    expect(page).not.toContain("/subscribe");
    expect(page).not.toContain("openPaywall");
    const planClient = readFileSync(resolve(process.cwd(), "src/components/PlanClient.tsx"), "utf8");
    expect(planClient).not.toContain("/subscribe");
    expect(planClient).not.toContain("Paywall");
    expect(planClient).not.toContain("openPaywall");
    const home = readFileSync(resolve(process.cwd(), "src/components/HomeClient.tsx"), "utf8");
    expect(home.match(/href="\/subscribe"/g)).toEqual(['href="/subscribe"']);
    expect(home).toContain('data-testid="home-tide-mark-plan"');
    expect(home).not.toContain('data-testid="home-tide-mark-plan-more"');
    expect(home).toContain("PLAN_OFFER_LINE");
    expect(home).toContain("planOfferVisible");
    expect(home).not.toContain("PlanSubscribeScreen");
    expect(home).not.toContain("PlanPaywall");
    expect(home).toContain("w-full min-w-0 max-w-full");
    expect(home).not.toContain("md:hidden");
    expect(home).not.toContain("max-lg:hidden");
    const subscribe = readFileSync(resolve(process.cwd(), "src/app/subscribe/page.tsx"), "utf8");
    expect(subscribe).toContain("PlanSubscribeScreen");
    const screen = readFileSync(resolve(process.cwd(), "src/components/PlanSubscribeScreen.tsx"), "utf8");
    expect(screen).toContain('data-testid="plan-iap-diagnostics"');
    expect(screen).toContain("planDiagnosticsRequested");
    expect(planDiagnosticsRequested("")).toBe(false);
    expect(planDiagnosticsRequested("?debug=1")).toBe(true);
    expect(planDiagnosticsRequested("debug=1")).toBe(true);
    expect(planDiagnosticsRequested("?debug=0")).toBe(false);
    expect(planDiagnosticsRequested("?foo=1&debug=1")).toBe(true);
    const iosOnly = "StoreKit is only available in the Tide Mark iOS app.";
    expect(planStorekitErrorForViewer(iosOnly, true)).toBeNull();
    expect(planStorekitErrorForViewer(iosOnly, false)).toBe(iosOnly);
    expect(planStorekitErrorForViewer("Purchase cancelled.", true)).toBe("Purchase cancelled.");
    const paywall = readFileSync(resolve(process.cwd(), "src/components/PlanPaywall.tsx"), "utf8");
    expect(paywall).toContain("planStorekitErrorForViewer");
    expect(paywall).toContain("insideTideMarkIosApp");
    expect(screen).toContain('data-testid="plan-included"');
    expect(ui).toContain('data-testid="plan-price-retry"');
    expect(ui).toContain('data-testid="plan-price-fallback"');
    const dev = readFileSync(resolve(process.cwd(), "src/app/dev/plan-paywall/page.tsx"), "utf8");
    expect(dev).toContain('process.env.NODE_ENV === "production"');
    expect(dev).toContain("notFound");
  });
});
