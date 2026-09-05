import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_DISPLAY_NAME, APP_LOGO_SRC } from "./brand";
import {
  APP_STORE_BUNDLE_ID,
  APP_STORE_LIVE_URL,
  APP_STORE_PRICE_YEARLY,
  APP_STORE_PRIVACY_URL,
  APP_STORE_PRODUCT_YEARLY,
  APP_STORE_SUBSCRIPTION_GROUP,
  APP_STORE_TRIAL,
  IOS_USAGE_DESCRIPTIONS,
  NATIVE_ICON_SOURCE,
} from "./native-app";

describe("App Store / Capacitor wrap", () => {
  it("locks bundle id, live URL, and usage strings into config and docs", () => {
    expect(APP_DISPLAY_NAME).toBe("Tide Mark");
    expect(APP_STORE_BUNDLE_ID).toBe("com.tidemark.logbook");
    expect(APP_STORE_LIVE_URL).toBe("https://fishing-catch-log-ivl7.onrender.com");
    expect(APP_STORE_PRIVACY_URL).toBe("https://fishing-catch-log-ivl7.onrender.com/privacy");
    expect(NATIVE_ICON_SOURCE).toBe(APP_LOGO_SRC);
    expect(APP_STORE_PRICE_YEARLY).toBe("$39.99/year");
    expect(APP_STORE_TRIAL).toBe("1-month free trial");
    expect(APP_STORE_PRODUCT_YEARLY).toBe("tidemark_premium_yearly");
    expect(APP_STORE_SUBSCRIPTION_GROUP).toBe("TideMarkPremium");

    const cap = readFileSync(resolve(process.cwd(), "capacitor.config.ts"), "utf8");
    expect(cap).toContain(`appId: "${APP_STORE_BUNDLE_ID}"`);
    expect(cap).not.toContain("com.tidemark.app");
    expect(cap).toContain(`appName: "${APP_DISPLAY_NAME}"`);
    expect(cap).toContain(`url: "${APP_STORE_LIVE_URL}"`);
    expect(cap).toContain(NATIVE_ICON_SOURCE);

    const pbx = resolve(process.cwd(), "ios/App/App.xcodeproj/project.pbxproj");
    if (existsSync(pbx)) {
      const proj = readFileSync(pbx, "utf8");
      expect(proj).toContain(`PRODUCT_BUNDLE_IDENTIFIER = ${APP_STORE_BUNDLE_ID};`);
      expect(proj).not.toContain("com.tidemark.app");
    }

    const docs = readFileSync(resolve(process.cwd(), "docs/app-store.md"), "utf8");
    expect(docs).toContain(APP_STORE_BUNDLE_ID);
    expect(docs).not.toContain("com.tidemark.app");
    expect(docs).toContain(APP_STORE_LIVE_URL);
    expect(docs).toContain(APP_STORE_PRIVACY_URL);
    expect(docs).toContain(IOS_USAGE_DESCRIPTIONS.NSCameraUsageDescription);
    expect(docs).toContain(IOS_USAGE_DESCRIPTIONS.NSLocationWhenInUseUsageDescription);
    expect(docs).toContain(IOS_USAGE_DESCRIPTIONS.NSPhotoLibraryUsageDescription);
    expect(docs).toContain(APP_STORE_PRICE_YEARLY);
    expect(docs).toContain(APP_STORE_TRIAL);
    expect(docs).toContain(APP_STORE_PRODUCT_YEARLY);
    expect(docs).toContain(APP_STORE_SUBSCRIPTION_GROUP);
    expect(docs).toContain("TideMarkStore");
    expect(docs).toContain("/api/entitlement/storekit");
    expect(docs).toContain("StoreKit");
    expect(docs).toContain("Linux");
    expect(docs).toContain("Mac");
    expect(docs).toContain("TestFlight");
    expect(docs).toContain("npx cap add ios");
    expect(docs).toContain(NATIVE_ICON_SOURCE);

    const plugin = readFileSync(resolve(process.cwd(), "ios/App/App/TideMarkStorePlugin.swift"), "utf8");
    expect(plugin).toContain(APP_STORE_PRODUCT_YEARLY);
    expect(plugin).toContain("StoreKit");
    expect(plugin).toContain("jsName = \"TideMarkStore\"");
    expect(plugin).toContain("func purchase");
    expect(plugin).toContain("func restore");
    const proj = readFileSync(resolve(process.cwd(), "ios/App/App.xcodeproj/project.pbxproj"), "utf8");
    expect(proj).toContain("TideMarkStorePlugin.swift");
    expect(proj).toContain("IPHONEOS_DEPLOYMENT_TARGET = 15.0;");
    const paywall = readFileSync(resolve(process.cwd(), "src/components/Paywall.tsx"), "utf8");
    expect(paywall).toContain("subscribe-disabled");
    expect(paywall).toContain("subscribe-yearly");
    expect(paywall).toContain("restore-purchases");
    expect(paywall).toContain("storekitPurchaseAvailable");
    const route = readFileSync(resolve(process.cwd(), "src/app/api/entitlement/storekit/route.ts"), "utf8");
    expect(route).toContain("activateFromStorekit");
    expect(route).toContain("tidemark_premium_yearly");

    const plist = resolve(process.cwd(), "ios/App/App/Info.plist");
    if (existsSync(plist)) {
      const xml = readFileSync(plist, "utf8");
      expect(xml).toContain("NSCameraUsageDescription");
      expect(xml).toContain(IOS_USAGE_DESCRIPTIONS.NSCameraUsageDescription);
      expect(xml).toContain("NSLocationWhenInUseUsageDescription");
      expect(xml).toContain(IOS_USAGE_DESCRIPTIONS.NSLocationWhenInUseUsageDescription);
      expect(xml).toContain("NSPhotoLibraryUsageDescription");
      expect(xml).toContain(IOS_USAGE_DESCRIPTIONS.NSPhotoLibraryUsageDescription);
    }
  });
});
