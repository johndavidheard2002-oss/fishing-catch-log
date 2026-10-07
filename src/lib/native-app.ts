/** App Store / Capacitor wrap constants. No signing lives here. */

export const APP_STORE_BUNDLE_ID = "com.tidemark.logbook";
export const APP_STORE_LIVE_URL = "https://fishing-catch-log-ivl7.onrender.com";
export const APP_STORE_PRIVACY_PATH = "/privacy";
export const APP_STORE_PRIVACY_URL = `${APP_STORE_LIVE_URL}${APP_STORE_PRIVACY_PATH}`;

/** Locked PWA / store icon sources. Do not regenerate the copper seal. */
export const NATIVE_ICON_SOURCE = "/brand/tide-mark-logo.png";
export const NATIVE_ICON_512 = "/icon-512.png";
export const NATIVE_ICON_192 = "/icon-192.png";
export const NATIVE_APPLE_TOUCH_ICON = "/apple-icon.png";
export const NATIVE_SPLASH_DIR = "/splash";

export const IOS_USAGE_DESCRIPTIONS = {
  NSCameraUsageDescription:
    "Tide Mark uses the camera to photograph your catch when you log a fish.",
  NSLocationWhenInUseUsageDescription:
    "Tide Mark uses your location to pin where you caught the fish on the map.",
  NSPhotoLibraryUsageDescription:
    "Tide Mark accesses your photo library so you can attach past catch photos.",
} as const;

export const APP_STORE_PRICE_YEARLY = "$29.99/year";

/**
 * Tide Mark Plan — auto-renewable monthly subscription for version 2.0.
 * Create this exact product in App Store Connect. Do not rename.
 */
export const APP_STORE_PLAN_PRODUCT_ID = "com.tidemark.logbook.plan.monthly";
export const APP_STORE_PLAN_SUBSCRIPTION_GROUP = "Tide Mark Plan";
export const APP_STORE_PLAN_PRICE = "$19.99/month";
export const APP_STORE_PLAN_TRIAL = "1-month free trial";

/**
 * Appended to the WKWebView user agent only by the 2.0 native shell
 * (`capacitor.config.ts` → `ios.appendUserAgent`). The live 1.0 binary
 * does not include this token, so the remote site must not show a Plan
 * purchase screen unless both this token and the iOS Capacitor bridge exist.
 */
export const NATIVE_PLAN_IAP_UA_TOKEN = "TideMarkPlanIAP/2";

/** Apple standard Licensed Application EULA. Fine for guideline 3.1.2. */
export const APPLE_STANDARD_EULA_URL =
  "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
