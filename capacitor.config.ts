import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native shell for Tide Mark. The WebView loads the live Render site so
 * sign-in cookies, photo uploads, GPS, and the camera keep working.
 *
 * Icon / splash sources (do not regenerate the copper seal):
 *   public/brand/tide-mark-logo.png
 *   public/icon-512.png, public/icon-192.png, public/apple-icon.png
 *   public/splash/apple-splash-*.png
 *
 * `npx cap add ios` needs a Mac. See docs/app-store.md.
 */
const config: CapacitorConfig = {
  appId: "com.tidemark.logbook",
  appName: "Tide Mark",
  webDir: "public",
  server: {
    url: "https://fishing-catch-log-ivl7.onrender.com",
    androidScheme: "https",
  },
  ios: {
    // `never` lets CSS env(safe-area-inset-*) own the notch / home indicator.
    // `automatic` fights viewport-fit=cover: WKWebView reports 0 insets while
    // the WebView still draws under the status bar and home indicator.
    contentInset: "never",
    preferredContentMode: "mobile",
    scheme: "Tide Mark",
    backgroundColor: "#140c09",
  },
};

export default config;
