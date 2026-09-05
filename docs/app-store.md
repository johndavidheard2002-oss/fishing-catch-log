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
5. **TestFlight** — Distribute the archive to App Store Connect, wait for processing, add internal testers.
6. **Subscription** — Create an auto-renewable yearly product at **$39.99/year** with a **1-month free trial**. StoreKit / paywall wiring is a later pass; this wrap only loads the live site.
7. **Review notes** — Demo account if Review cannot create one; explain camera, location, and photo library prompts with the strings above.

## Out of scope (this wrap)

- Code signing, notarization, or uploading builds
- TestFlight / Connect API keys
- Regenerating `public/brand/tide-mark-logo.png` or the PWA icons
- Teal / bait / share UI changes
