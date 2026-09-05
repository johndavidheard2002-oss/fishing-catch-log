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

export const APP_STORE_PRICE_YEARLY = "$39.99/year";
export const APP_STORE_TRIAL = "1-month free trial";
