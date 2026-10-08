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
| Marketing version | **2.0** (`MARKETING_VERSION` in the Xcode project; Info.plist keeps the `$(MARKETING_VERSION)` placeholder). Codemagic reads that build setting and sets the build number to the highest TestFlight or App Store build across all versions + 1. |
| Pricing | Log, Calendar, and Spots stay **free**. **Tide Mark Plan** is **$19.99/month** after a **1-month free trial** |
| In-App Purchase | `com.tidemark.logbook.plan.monthly` (auto-renewable, subscription group **Tide Mark Plan**) |
| 2.0 shell marker | WebView user agent token `TideMarkPlanIAP/2` (`ios.appendUserAgent`). The 1.0 binary does not send it. |
| Icon / seal | `public/brand/tide-mark-logo.png` (locked copper seal — TIDE MARK / SALTWATER LOGBOOK, fish-eye map pin; do not redraw). iOS AppIcon is the opaque 1024 near-black square. |
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
4. Usage strings, `WKAppBoundDomains`, and `ITSAppUsesNonExemptEncryption` (`false`) in `ios/App/App/Info.plist`
5. App icon + splash files copied from the locked copper seal (TIDE MARK / SALTWATER LOGBOOK). iOS AppIcon is opaque 1024, no alpha.
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

Confirm `ios/App/App/Info.plist` still has the three usage strings above (they are already committed). The app uses only standard HTTPS / OS encryption, so export compliance is already baked in as `ITSAppUsesNonExemptEncryption` = `false`. The next Codemagic IPA upload should skip the App Store Connect export-compliance questionnaire. Keep the live host as an app-bound domain so cookies and the service worker stay first-party:

```xml
<key>WKAppBoundDomains</key>
<array>
  <string>fishing-catch-log-ivl7.onrender.com</string>
</array>
```

### Icons and splash (existing art only)

Do not redraw the copper seal. The locked art is the circular ring with TIDE MARK / SALTWATER LOGBOOK and the fish-eye map pin. iOS AppIcon is the opaque near-black 1024. Copies are already in `resources/`; on a Mac you can still refresh them, then let Capacitor resize:

```bash
mkdir -p resources
cp ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png resources/icon.png
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
2. **Privacy** — Policy URL `https://fishing-catch-log-ivl7.onrender.com/privacy`. Declare account email, photos, precise location, and friend sharing. Deletion is in the app: Home → Delete account (password, type DELETE, Delete my account). Email is only a backup if they cannot sign in.
3. **Certificates / profiles** — In Xcode, enable Automatic Signing and pick the team. Or create an Apple Distribution cert and App Store provisioning profile in the developer portal. Not done in this repo.
4. **Archive** — Destination: Any iOS Device. Product → Archive.
5. **TestFlight** — Prefer the Codemagic `ios-testflight` workflow below. Manual path: archive in Xcode, upload to App Store Connect, add internal testers. `Info.plist` already sets `ITSAppUsesNonExemptEncryption` to `false` (HTTPS / OS encryption only), so App Store Connect should not ask the export-compliance questions on each upload.
6. **Subscription** — Auto-renewable product **`com.tidemark.logbook.plan.monthly`** in a subscription group named **Tide Mark Plan**, **$19.99/month** (USD), with a **1-month free trial** introductory offer. Do **not** reuse `tidemark_premium_yearly`. The rest of the app stays free. **John must create this product in App Store Connect** before review — the id and group name have to match the app exactly. ASC is authoritative for the charged price; the paywall uses StoreKit’s localized price when the product loads, and falls back to $19.99/month.
7. **Review notes** — Demo account if Review cannot create one; explain camera, location, and photo library prompts with the strings above. Account deletion is inside the app (guideline 5.1.1(v)), not by email alone. Recording path: create account or sign in → Home account card (name and email) → Delete account → password → type DELETE → Delete my account → Sign in / Create account.
8. **In-App Purchase capability** — In Xcode, add the **In-App Purchase** capability on the App target. StoreKit 2 lives in `ios/App/App/TideMarkStorePlugin.swift` (Capacitor plugin `TideMarkStore`). Minimum iOS is **15.0**.

## StoreKit / Plan paywall (2.0)

The iOS app is a Capacitor WebView pointed at the live Render site (`server.url`). The same JavaScript runs for the website, the 1.0 app, and 2.0. Plan is paid only when **both** are true:

1. `Capacitor.isNativePlatform()` and platform `ios`
2. The WebView user agent contains `TideMarkPlanIAP/2`

That token is baked into the 2.0 binary by `ios.appendUserAgent` in `capacitor.config.ts`. The live 1.0 binary does not append it, so a Render deploy does not show 1.0 users a purchase screen. Safari and Add to Home Screen never have the token either, so Plan stays included there. The 2.0 plugin method `planOffer` is what reads StoreKit; 1.0 does not implement it and the site does not call purchase unless the token is present.

Inside 2.0, Plan calls StoreKit for **`com.tidemark.logbook.plan.monthly`**. Purchase and Restore read the verified transaction (including expiration and revocation). Relaunch calls `planOffer`, which uses `Transaction.latest`, so an expired or cancelled subscription locks Plan again. An active introductory trial stays unlocked until Apple’s expiration date. `POST /api/entitlement/storekit` records the term on the journal. That record does **not** lock Log, Calendar, or Spots — `JOURNAL_FREE_FOR_RELEASE` stays on.

| | |
| --- | --- |
| Product ID | `com.tidemark.logbook.plan.monthly` |
| Subscription group | Tide Mark Plan |
| Price | $19.99/month |
| Intro | 1-month free trial (App Store Connect introductory offer) |
| 2.0 marker | `TideMarkPlanIAP/2` |
| Capacitor plugin | `TideMarkStore` (`planOffer`, `getProduct`, `purchase`, `restore`) |
| Server | `POST /api/entitlement/storekit` (signed-in cookie) |
| Web and 1.0 | Plan stays included. No subscribe button. |

Linux CI can run the TypeScript tests (claim parsing, entitlement activate/restore, Capacitor detection). They do **not** talk to StoreKit. On a Mac, verify the real sheet:

```bash
npx cap sync ios
npx cap open ios
```

In Xcode: enable In-App Purchase, attach `ios/App/App/TideMarkPlan.storekit` (product id exactly `com.tidemark.logbook.plan.monthly`, group **Tide Mark Plan**, $19.99/month, 1-month free intro) or use a sandbox Apple ID against App Store Connect. Confirm purchase and Restore unlock Plan, that an expired date locks Plan again, and that Safari still opens Plan with no paywall.

Full App Store Server API receipt verification is not in this pass — the native plugin only forwards a StoreKit 2 transaction the device already verified. Add Apple JWS / server-notification checks later if you need to reject spoofed POSTs.

## Codemagic → TestFlight

Stay on a **Codemagic personal (free) account**. Do **not** create a Codemagic Team — that asks for a credit card and removes free minutes. Personal accounts cannot use Team integrations → Developer Portal the way `integrations.app_store_connect: Tide Mark` expects.

Repo-root `codemagic.yaml` defines a single workflow, `ios-testflight`. It signs via the App Store Connect API (`fetch-signing-files --certificate-key=@env:CERTIFICATE_PRIVATE_KEY --create`), checks that the resolved `MARKETING_VERSION` is 2.0, sets the build number to the highest TestFlight or App Store build across all versions + 1, and uploads an IPA. It does **not** submit to App Store review. No secrets belong in the YAML.

1. In App Store Connect → Users and Access → Integrations → App Store Connect API, create a key with **App Manager** access. Download the `.p8` once. Note the Issuer ID and Key ID.
2. In Codemagic, add application → connect GitHub → `johndavidheard2002-oss/fishing-catch-log`. Scan `codemagic.yaml` on branch `cursor/fishing-catch-log-app-caca`.
3. In the **app’s Environment variables** tab (not Team settings), create a group named **`app_store_credentials`** and add these as **Secret**:
   - `APP_STORE_CONNECT_ISSUER_ID` — Issuer ID from App Store Connect
   - `APP_STORE_CONNECT_KEY_IDENTIFIER` — Key ID
   - `APP_STORE_CONNECT_PRIVATE_KEY` — full contents of the `.p8`, including the `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` lines
   - `CERTIFICATE_PRIVATE_KEY` — PEM RSA private key (including `-----BEGIN RSA PRIVATE KEY-----` / `-----END RSA PRIVATE KEY-----` lines) used only so `--create` can mint a new Apple Distribution certificate whose private key Codemagic holds. **Do not put this key in the repo.** Generate one locally (e.g. `openssl genrsa -out cert_key.pem 2048`) and paste the PEM into the Secret. This is a different key from `APP_STORE_CONNECT_PRIVATE_KEY` (the App Store Connect API `.p8`).
4. Start the **ios-testflight** workflow on that branch. Signing files (Apple Distribution cert + App Store profile for `com.tidemark.logbook`) are created by `app-store-connect fetch-signing-files --type IOS_APP_STORE --certificate-key=@env:CERTIFICATE_PRIVATE_KEY --create` using those env vars. Without `--certificate-key`, the CLI finds existing Apple Distribution certs on the account but cannot save them (`Cannot save Signing Certificates without certificate private key`). No Codemagic Team, no Developer Portal integration, and no manual `.p12` upload. When it finishes, the build appears in App Store Connect → TestFlight. Publishing authenticates with the same env vars (`api_key` / `key_id` / `issuer_id`). See [Signing iOS apps](https://docs.codemagic.io/yaml-code-signing/signing-ios/) and [App Store Connect publishing](https://docs.codemagic.io/yaml-publishing/app-store-connect/).

   **Home-screen / App Store icon:** a Render (web) deploy does **not** update the native iOS icon. After this asset changes, start a fresh Codemagic **ios-testflight** build so TestFlight testers get a new IPA with `AppIcon.appiconset`.

   If Apple is at the Distribution certificate limit (**3**), revoke an unused **iOS Distribution** cert in [developer.apple.com → Certificates](https://developer.apple.com/account/resources/certificates/list) before re-running the workflow. Revoking a cert invalidates profiles that used it; `--create` will issue a new cert + App Store profile.

## Verify offline (device / simulator)

The App Store wrap still loads the live site. Offline / local-first uses the existing service worker plus an on-device queue (IndexedDB): already-opened Calendar List/Grid/detail, a camera photo, and a full draft log (photo + form + GPS). Weather, tides, and map tiles wait for service.

1. Open Tide Mark online (Safari Add to Home Screen, or the Capacitor WebView) and sign in. Visit **Calendar Log** (List, Grid, and at least one catch detail) and **Log** so the shell is cached.
2. Turn on Airplane Mode, or in Safari Web Inspector → Network choose Offline.
3. Calendar List/Grid/detail should still show trips already on this phone. Photos already viewed stay from cache.
4. On **Log**, take a camera photo. Device GPS can still drop a pin. Map tiles may be blank — pin dropping on the map can wait. Save the catch.
5. Confirm the locked copy: **Offline. This log is saved…**, location/conditions fill-later notes, and a **Waiting for service** chip on the queued trip.
6. Turn the network back on. The queued log should upload. Weather/tides/conditions fill on sync. If location or date-time are still empty, the manual-entry note appears.
7. The journal stays usable when the network returns. Plan’s subscription check is the native StoreKit bridge in 2.0; the website does not soft-lock Log, Calendar, or Plan.

Linux CI covers the queue/sync unit tests (`npm test`). It cannot exercise Airplane Mode on a phone.

## Out of scope (this wrap)

- Regenerating `public/brand/tide-mark-logo.png` or the PWA icons (locked copper seal)
- Teal / bait / share UI changes
- Compiling or running StoreKit on Linux — use a Mac for the real purchase sheet
- Submitting the IPA to App Store review (`submit_to_app_store` stays false)
