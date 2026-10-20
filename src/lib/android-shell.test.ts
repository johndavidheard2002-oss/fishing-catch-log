import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ANDROID_PERMISSION_RATIONALES, PLAY_PLAN_BASE_PLAN_ID, PLAY_PLAN_OFFER_ID, PLAY_PLAN_PRODUCT_ID, PLAY_PACKAGE_NAME } from "./native-app";
import { planGateAllowsPath } from "./plan-gate";

describe("Android shell", () => {
  it("matches the iOS bundle id, permissions, and Play product ids", () => {
    const root = process.cwd();
    const manifest = readFileSync(resolve(root, "android/app/src/main/AndroidManifest.xml"), "utf8");
    const strings = readFileSync(resolve(root, "android/app/src/main/res/values/strings.xml"), "utf8");
    const gradle = readFileSync(resolve(root, "android/app/build.gradle"), "utf8");
    const plugin = readFileSync(
      resolve(root, "android/app/src/main/java/com/tidemark/logbook/TideMarkStorePlugin.java"),
      "utf8",
    );
    const activity = readFileSync(
      resolve(root, "android/app/src/main/java/com/tidemark/logbook/MainActivity.java"),
      "utf8",
    );
    const cap = readFileSync(resolve(root, "capacitor.config.ts"), "utf8");
    const codemagic = readFileSync(resolve(root, "codemagic.yaml"), "utf8");

    expect(strings).toContain(`<string name="app_name">Tide Mark</string>`);
    expect(strings).toContain(ANDROID_PERMISSION_RATIONALES.camera);
    expect(strings).toContain(ANDROID_PERMISSION_RATIONALES.location);
    expect(strings).toContain(ANDROID_PERMISSION_RATIONALES.photos);
    expect(gradle).toContain(`applicationId "${PLAY_PACKAGE_NAME}"`);
    expect(gradle).toContain('versionName "2.0"');
    expect(gradle).toContain("com.android.billingclient:billing:");
    expect(gradle).toContain("CM_KEYSTORE_PATH");
    expect(manifest).toContain("android.permission.CAMERA");
    expect(manifest).toContain("android.permission.ACCESS_FINE_LOCATION");
    expect(manifest).toContain("android.permission.ACCESS_COARSE_LOCATION");
    for (const media of [
      "READ_MEDIA_IMAGES",
      "READ_MEDIA_VIDEO",
      "READ_MEDIA_VISUAL_USER_SELECTED",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE",
    ]) {
      expect(manifest).toMatch(new RegExp(`android.permission.${media}" tools:node="remove"`));
    }
    expect(manifest).toContain("com.android.vending.BILLING");
    expect(plugin).toContain(PLAY_PLAN_PRODUCT_ID);
    expect(plugin).toContain(PLAY_PLAN_BASE_PLAN_ID);
    expect(plugin).toContain(PLAY_PLAN_OFFER_ID);
    expect(plugin).toContain("acknowledgePurchase");
    expect(plugin).toContain('@CapacitorPlugin(name = "TideMarkStore")');
    expect(activity).toContain("registerPlugin(TideMarkStorePlugin.class)");
    expect(cap).toContain('appendUserAgent: "TideMarkPlanIAP/2 TideMarkBuild/14"');
    expect(codemagic).toContain("android-release:");
    expect(codemagic).toContain("tidemark_upload");
    expect(codemagic).not.toContain("google_play:");
    expect(existsSync(resolve(root, "android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml"))).toBe(true);
    expect(existsSync(resolve(root, "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png"))).toBe(true);
    expect(planGateAllowsPath("/terms")).toBe(true);
    const terms = readFileSync(resolve(root, "src/app/terms/page.tsx"), "utf8");
    expect(terms).toContain('data-testid="terms-page"');
    expect(terms).toContain("Google Play");
  });
});
