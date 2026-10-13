/** App Store / Capacitor wrap constants. No signing lives here. */

export const APP_STORE_BUNDLE_ID = "com.tidemark.logbook";
export const APP_STORE_LIVE_URL = "https://fishing-catch-log-ivl7.onrender.com";
export const APP_STORE_PRIVACY_PATH = "/privacy";
export const APP_STORE_PRIVACY_URL = `${APP_STORE_LIVE_URL}${APP_STORE_PRIVACY_PATH}`;

/**
 * Hosts the iOS WebView may navigate to while `limitsNavigationsToAppBoundDomains`
 * is on. Sign-in, cookies, and `/api` (auth, tides, weather) are the live host.
 * `localhost` is Capacitor's local origin. NOAA, OpenWeather, and map tile hosts
 * are server or image fetches, not WebView navigations, so they stay off this list.
 */
export const IOS_WEBVIEW_HOST = new URL(APP_STORE_LIVE_URL).host;
export const IOS_APP_BOUND_DOMAINS = [IOS_WEBVIEW_HOST, "localhost"] as const;

/**
 * Linked from the UI and opened outside the WebView (Safari or Mail).
 * They must not be app-bound domains, or the WebView would try to load them.
 */
export const IOS_EXTERNAL_LINK_HOSTS = ["www.apple.com", "www.openstreetmap.org"] as const;

export function iosWebViewKeepsHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/\.$/, "");
  return (IOS_APP_BOUND_DOMAINS as readonly string[]).includes(normalized);
}

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
 * Tide Mark Plan — auto-renewable annual subscription for version 2.0.
 * Create this exact product in a new App Store Connect subscription group.
 * The previous Tide Mark Plan group is Developer Rejected. Do not reuse
 * `tidemark_premium_yearly`.
 */
export const APP_STORE_PLAN_PRODUCT_ID = "com.tidemark.logbook.plan.annual";
/**
 * Earlier product ids. New purchases use `.annual`. Restore still accepts
 * these so an existing subscriber stays entitled.
 */
export const APP_STORE_PLAN_YEARLY_PRODUCT_ID = "com.tidemark.logbook.plan.yearly";
export const APP_STORE_PLAN_MONTHLY_PRODUCT_ID = "com.tidemark.logbook.plan.monthly";
export const APP_STORE_PLAN_SUBSCRIPTION_GROUP = "Tide Mark Plan";
export const APP_STORE_PLAN_PRICE = "$19.99/year";
export const APP_STORE_PLAN_TRIAL = "1-month free trial";

/**
 * Appended to the WKWebView user agent by the 2.0 native shell
 * (`capacitor.config.ts` → `ios.appendUserAgent`). This is enough for the
 * Home button even when the Capacitor bridge script is not injected.
 * iPad can omit it from a desktop user agent; the TideMarkStore header is
 * the other 2.0 signal. The 1.0 binary has neither. The website has neither.
 */
export const NATIVE_PLAN_IAP_UA_TOKEN = "TideMarkPlanIAP/2";
/**
 * First binary whose TideMarkStore purchase actually works. Older TestFlight
 * builds can send TideMarkPlanIAP/2 and still have no working purchase.
 */
export const NATIVE_PLAN_IAP_MIN_BUILD = 14;
export const NATIVE_PLAN_BUILD_UA_TOKEN = `TideMarkBuild/${NATIVE_PLAN_IAP_MIN_BUILD}`;

/** Apple standard Licensed Application EULA. Fine for guideline 3.1.2. */
export const APPLE_STANDARD_EULA_URL =
  "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
