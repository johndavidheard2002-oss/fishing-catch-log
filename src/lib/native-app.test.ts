import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_DISPLAY_NAME, APP_LOGO_SRC } from "./brand";
import {
  APP_STORE_BUNDLE_ID,
  APP_STORE_LIVE_URL,
  APP_STORE_PLAN_PRICE,
  APP_STORE_PLAN_PRODUCT_ID,
  APP_STORE_PLAN_SUBSCRIPTION_GROUP,
  APP_STORE_PLAN_TRIAL,
  APP_STORE_PRIVACY_URL,
  NATIVE_PLAN_IAP_UA_TOKEN,
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
    expect(APP_STORE_PLAN_PRICE).toBe("$19.99/month");
    expect(APP_STORE_PLAN_TRIAL).toBe("1-month free trial");
    expect(APP_STORE_PLAN_PRODUCT_ID).toBe("com.tidemark.logbook.plan.monthly");
    expect(APP_STORE_PLAN_SUBSCRIPTION_GROUP).toBe("Tide Mark Plan");
    expect(NATIVE_PLAN_IAP_UA_TOKEN).toBe("TideMarkPlanIAP/2");

    const cap = readFileSync(resolve(process.cwd(), "capacitor.config.ts"), "utf8");
    expect(cap).toContain(`appId: "${APP_STORE_BUNDLE_ID}"`);
    expect(cap).not.toContain("com.tidemark.app");
    expect(cap).toContain(`appName: "${APP_DISPLAY_NAME}"`);
    expect(cap).toContain(`url: "${APP_STORE_LIVE_URL}"`);
    expect(cap).toContain(NATIVE_ICON_SOURCE);
    expect(cap).toContain('contentInset: "never"');
    expect(cap).toContain(`appendUserAgent: "${NATIVE_PLAN_IAP_UA_TOKEN}"`);

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
    expect(docs).toContain(APP_STORE_PLAN_PRICE);
    expect(docs).toContain(APP_STORE_PLAN_TRIAL);
    expect(docs).toContain(APP_STORE_PLAN_PRODUCT_ID);
    expect(docs).toContain(APP_STORE_PLAN_SUBSCRIPTION_GROUP);
    expect(docs).toContain(NATIVE_PLAN_IAP_UA_TOKEN);
    expect(docs).toContain("TideMarkStore");
    expect(docs).toContain("/api/entitlement/storekit");
    expect(docs).toContain("StoreKit");
    expect(docs).toContain("Linux");
    expect(docs).toContain("Mac");
    expect(docs).toContain("TestFlight");
    expect(docs).toContain("npx cap add ios");
    expect(docs).toContain(NATIVE_ICON_SOURCE);
    expect(docs).toContain("ITSAppUsesNonExemptEncryption");

    const plugin = readFileSync(resolve(process.cwd(), "ios/App/App/TideMarkStorePlugin.swift"), "utf8");
    expect(plugin).toContain(APP_STORE_PLAN_PRODUCT_ID);
    expect(plugin).toContain("func planOffer");
    expect(plugin).toContain("Transaction.latest");
    expect(plugin).toContain("StoreKit");
    expect(plugin).toContain("jsName = \"TideMarkStore\"");
    expect(plugin).toContain("func purchase");
    expect(plugin).toContain("func restore");
    expect(plugin).toContain("verification.jwsRepresentation");
    expect(plugin).toContain("result.jwsRepresentation");
    expect(plugin).not.toContain("transaction.jwsRepresentation");
    expect(plugin).not.toContain("@unknown default: return \"unknown\"");
    const proj = readFileSync(resolve(process.cwd(), "ios/App/App.xcodeproj/project.pbxproj"), "utf8");
    expect(proj).toContain("TideMarkStorePlugin.swift");
    expect(proj).toContain("IPHONEOS_DEPLOYMENT_TARGET = 15.0;");
    expect(proj).toContain("MARKETING_VERSION = 2.0;");
    expect(proj).not.toContain("MARKETING_VERSION = 1.0;");
    expect(proj).toContain("CURRENT_PROJECT_VERSION = 2;");
    const cm = readFileSync(resolve(process.cwd(), "codemagic.yaml"), "utf8");
    expect(cm).toContain("-showBuildSettings");
    expect(cm).toContain("--all-versions");
    expect(cm).toContain('Expected marketing version 2.0');
    expect(cm).not.toContain("agvtool what-marketing-version");
    const paywall = readFileSync(resolve(process.cwd(), "src/components/Paywall.tsx"), "utf8");
    expect(paywall).toContain("subscribe-disabled");
    expect(paywall).toContain("subscribe-yearly");
    expect(paywall).toContain("restore-purchases");
    expect(paywall).toContain("storekitPurchaseAvailable");
    const route = readFileSync(resolve(process.cwd(), "src/app/api/entitlement/storekit/route.ts"), "utf8");
    expect(route).toContain("activateFromStorekit");
    expect(route).toContain(APP_STORE_PLAN_PRODUCT_ID);

    const plist = resolve(process.cwd(), "ios/App/App/Info.plist");
    if (existsSync(plist)) {
      const xml = readFileSync(plist, "utf8");
      expect(xml).toContain("NSCameraUsageDescription");
      expect(xml).toContain(IOS_USAGE_DESCRIPTIONS.NSCameraUsageDescription);
      expect(xml).toContain("NSLocationWhenInUseUsageDescription");
      expect(xml).toContain(IOS_USAGE_DESCRIPTIONS.NSLocationWhenInUseUsageDescription);
      expect(xml).toContain("NSPhotoLibraryUsageDescription");
      expect(xml).toContain(IOS_USAGE_DESCRIPTIONS.NSPhotoLibraryUsageDescription);
      expect(xml).toMatch(
        /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\s*\/>/,
      );
    }
  });

  it("keeps the locked 1024 copper seal as the opaque iOS AppIcon", () => {
    const icon = resolve(process.cwd(), "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png");
    const brand = resolve(process.cwd(), "public/brand/tide-mark-logo.png");
    const resources = resolve(process.cwd(), "resources/icon.png");
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const iconBytes = readFileSync(icon);
    const brandBytes = readFileSync(brand);
    expect(existsSync(icon)).toBe(true);
    expect(iconBytes.subarray(0, 8).equals(png)).toBe(true);
    expect(brandBytes.subarray(0, 8).equals(png)).toBe(true);
    expect(iconBytes.equals(readFileSync(resources))).toBe(true);
    expect(iconBytes.readUInt32BE(16)).toBe(1024);
    expect(iconBytes.readUInt32BE(20)).toBe(1024);
    expect(brandBytes.readUInt32BE(16)).toBe(1024);
    expect(brandBytes.readUInt32BE(20)).toBe(1024);
    // iOS App Store icons cannot have an alpha channel (PNG color type 2 = RGB).
    expect(iconBytes[25]).toBe(2);
  });
});
