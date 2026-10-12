import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native shell for Tide Mark. The WebView loads the live Render site so
 * sign-in cookies, photo uploads, GPS, and the camera keep working.
 *
 * Icon / splash sources (locked copper seal: TIDE MARK / SALTWATER LOGBOOK):
 *   public/brand/tide-mark-logo.png
 *   resources/icon.png, resources/splash.png
 *   public/icon-512.png, public/icon-192.png, public/apple-icon.png
 *   public/splash/apple-splash-*.png
 *   ios AppIcon is the opaque 1024 near-black seal (no alpha).
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
    // 2.0-only marker. The 1.0 App Store binary does not append this, so the
    // live site can keep Plan free for that build and for the website.
    // This is WKWebViewConfiguration, so it is present even when the bridge
    // user script is not injected.
    appendUserAgent: "TideMarkPlanIAP/2",
    // Info.plist sets WKAppBoundDomains. Capacitor leaves this false, and
    // then WebKit does not inject the bridge or TideMarkStore. Build 9 has
    // that bug. The next binary needs this true or the purchase sheet cannot
    // present. localhost is listed next to the Render host for the local
    // Capacitor origin.
    limitsNavigationsToAppBoundDomains: true,
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
