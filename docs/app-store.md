# Tide Mark — App Store / Capacitor wrap

Apple Developer enrollment can stay **Pending**. This repo is ready to wrap the live site in a Capacitor iOS WebView. Do **not** create certificates, an App Store Connect record, or a TestFlight build until enrollment is Active.

## Product

| | |
| --- | --- |
| Display name | Tide Mark |
| Tagline | Private saltwater logbook |
| Bundle ID | `com.tidemark.logbook` |
| Live WebView URL | https://fishing-catch-log-ivl7.onrender.com |
| Privacy policy URL | https://fishing-catch-log-ivl7.onrender.com/privacy |
| Pricing draft | **$39.99/year** after a **1-month free trial** |
| In-App Purchase | `tidemark_premium_yearly` (auto-renewable, group **TideMarkPremium**) |
| Icon / seal | `public/brand/tide-mark-logo.png` (locked — do not regenerate) |
| PWA icons | `public/icon-192.png`, `public/icon-512.png`, `public/apple-icon.png` |
| PWA splash | `public/splash/apple-splash-*.png` |

`capacitor.config.ts` already sets `appId`, `appName`, and `server.url` to the live Render host so auth cookies, photo uploads, GPS, and the camera keep working inside the WebView.

## iOS permission strings

Put these on the App Store Connect privacy answers **and** in `ios/App/App/Info.plist` once the Xcode project exists.

| Key | String |
| --- | --- |
| `NSCameraUsageDescription` | Tide Mark uses the camera to photograph your catch when you log a fish. |
| `NSLocationWhenInUseUsageDescription` | Tide Mark uses your location to pin where you caught the fish on the map. |
| `NSPhotoLibraryUsageDescription` | Tide Mark accesses your photo library so you can attach past catch photos. |

## What this Linux checkout already shipped

No Mac pool was available. Already in the repo:

1. `@capacitor/core`, `@capacitor/cli`, and `@capacitor/ios`
2. `capacitor.config.ts` pointed at the production URL
3. `ios/` Xcode project from `npx cap add ios` (worked on Linux; **CocoaPods and xcodebuild were skipped**)
4. Usage strings and `WKAppBoundDomains` in `ios/App/App/Info.plist`
5. App icon + splash files copied from `public/brand/tide-mark-logo.png` (same seal, not new art)
6. Public `/privacy` page (Help, sign-in footer, and Home → More link to it)
7. This checklist

On a Mac you still need Xcode, `pod install`, and Archive. Do not re-run `npx cap add ios` unless you delete `ios/` first.

## Mac steps (after a Mac is available)

From a clean clone of this branch:

```bash
npm ci
npx cap sync ios
```

If `ios/` is missing for any reason:

```bash
npx cap add ios
```

### Info.plist

Confirm `ios/App/App/Info.plist` still has the three usage strings above (they are already committed). Keep the live host as an app-bound domain so cookies and the service worker stay first-party:

```xml
<key>WKAppBoundDomains</key>
<array>
  <string>fishing-catch-log-ivl7.onrender.com</string>
</array>
```

### Icons and splash (existing art only)

Do not redraw the copper seal. Copy the locked files, then let Capacitor resize them on the Mac:

```bash
mkdir -p resources
cp public/brand/tide-mark-logo.png resources/icon.png
cp public/brand/tide-mark-logo.png resources/splash.png
npx @capacitor/assets generate --ios \
  --iconBackgroundColor '#040a13' \
  --splashBackgroundColor '#040a13'
npx cap sync ios
```

PWA splash PNGs under `public/splash/` stay for Add to Home Screen. The native splash is generated from the same seal.

```bash
npx cap open ios
```

Xcode opens `ios/App/App.xcworkspace`. Signing team, archive, and upload wait for enrollment.

## Post-enrollment checklist

Do these only after Apple Developer is **Active**. Still no need to change the web app.

1. **App Store Connect app** — New app, name Tide Mark, bundle ID `com.tidemark.logbook`, SKU of your choice (e.g. `tidemark`).
2. **Privacy** — Policy URL `https://fishing-catch-log-ivl7.onrender.com/privacy`. Declare account email, photos, precise location, and friend sharing. Deletion: email from the account address (see the privacy page).
3. **Certificates / profiles** — In Xcode, enable Automatic Signing and pick the team. Or create an Apple Distribution cert and App Store provisioning profile in the developer portal. Not done in this repo.
4. **Archive** — Destination: Any iOS Device. Product → Archive.
5. **TestFlight** — Prefer the Codemagic `ios-testflight` workflow below. Manual path: archive in Xcode, upload to App Store Connect, add internal testers.
6. **Subscription** — Auto-renewable product **`tidemark_premium_yearly`** in subscription group **TideMarkPremium**, **$39.99/year**, with the **1-month free intro** already configured in App Store Connect. The web journal still runs its own 30-day trial clock; StoreKit purchase/restore is what marks `subscription_status` **active**.
7. **Review notes** — Demo account if Review cannot create one; explain camera, location, and photo library prompts with the strings above.
8. **In-App Purchase capability** — In Xcode, add the **In-App Purchase** capability on the App target. StoreKit 2 lives in `ios/App/App/TideMarkStorePlugin.swift` (Capacitor plugin `TideMarkStore`). Minimum iOS is **15.0**.

## StoreKit / paywall

The live site still shows a disabled “Coming with the App Store build” Subscribe button in Safari and Add to Home Screen. Inside the Capacitor iOS WebView (`Capacitor.isNativePlatform()` + `ios`), Subscribe and Restore call StoreKit for **`tidemark_premium_yearly`** only, then `POST /api/entitlement/storekit` so the server marks the signed-in journal `active` (or `expired` if StoreKit’s expiration is already past). The web trial clock is not reset.

| | |
| --- | --- |
| Product ID | `tidemark_premium_yearly` |
| Subscription group | TideMarkPremium |
| Price | $39.99/year |
| Intro | 1-month free (App Store Connect) |
| Capacitor plugin | `TideMarkStore` (`getProduct`, `purchase`, `restore`) |
| Server | `POST /api/entitlement/storekit` (signed-in cookie) |
| Web | Buy stays disabled / coming soon |

Linux CI can run the TypeScript tests (claim parsing, entitlement activate/restore, Capacitor detection). They do **not** talk to StoreKit. On a Mac, verify the real sheet:

```bash
npx cap sync ios
npx cap open ios
```

In Xcode: enable In-App Purchase, attach a StoreKit Configuration (product id exactly `tidemark_premium_yearly`, group TideMarkPremium, $39.99/year, 1-month free intro) or use a sandbox Apple ID against App Store Connect. Confirm purchase and Restore unlock the journal, and that Safari still shows the disabled Subscribe button.

Full App Store Server API receipt verification is not in this pass — the native plugin only forwards a StoreKit 2 transaction the device already verified. Add Apple JWS / server-notification checks later if you need to reject spoofed POSTs.

## Codemagic → TestFlight

Repo-root `codemagic.yaml` defines a single workflow, `ios-testflight`. It signs with an App Store profile, bumps the build number from TestFlight (falling back to the App Store), and uploads an IPA. It does **not** submit to App Store review. No secrets belong in the YAML.

1. In App Store Connect → Users and Access → Integrations → App Store Connect API, create a key with **App Manager** access. Download the `.p8` once. Note the Issuer ID and Key ID.
2. In Codemagic → Team settings → Team integrations → Developer Portal → Manage keys, add that key. The name **must** be exactly **Tide Mark** — that is what `integrations.app_store_connect` in `codemagic.yaml` references.
3. In Codemagic → Team settings → Code signing identities, use that **Tide Mark** key to **Generate** (or **Fetch**) an Apple Distribution certificate, then **Fetch** the App Store provisioning profile for `com.tidemark.logbook`. The workflow’s `ios_signing` block pulls those files automatically each build.
4. Add application → connect GitHub → `johndavidheard2002-oss/fishing-catch-log`. Scan `codemagic.yaml` on branch `cursor/fishing-catch-log-app-caca`.
5. Start the **ios-testflight** workflow on that branch. When it finishes, the build appears in App Store Connect → TestFlight.

## Out of scope (this wrap)

- Regenerating `public/brand/tide-mark-logo.png` or the PWA icons
- Teal / bait / share UI changes
- Compiling or running StoreKit on Linux — use a Mac for the real purchase sheet
- Submitting the IPA to App Store review (`submit_to_app_store` stays false)
