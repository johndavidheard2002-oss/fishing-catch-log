# Tide Mark — Android / Google Play

The Android app is a Capacitor 7 shell. It loads the same Render site as the iOS app (`https://fishing-catch-log-ivl7.onrender.com`). Nothing in this repo uploads to Google Play.

| | |
| --- | --- |
| Display name | Tide Mark |
| applicationId | `com.tidemark.logbook` |
| Marketing version | 2.0 (`versionName`) |
| versionCode | At least `3` (floor in `app/build.gradle`). Codemagic passes `-PVERSION_CODE` from `PROJECT_BUILD_NUMBER`. |
| User agent | `TideMarkPlanIAP/2 TideMarkBuild/14` (same marker as iOS, so the Plan gate and write guard apply) |
| Billing | Play Billing Library **8.3.0** (compileSdk/targetSdk 36) |
| Product id | `tidemark_plan_yearly` |
| Base plan id | `yearly` |
| Offer id | `free-month` (1 month free, then $19.99/year) |
| Plugin | `TideMarkStore` (`planOffer`, `getProduct`, `purchase`, `restore`) in `android/app/src/main/java/com/tidemark/logbook/TideMarkStorePlugin.java` |
| Server | `POST /api/entitlement/play` |
| Terms | https://fishing-catch-log-ivl7.onrender.com/terms |
| Privacy | https://fishing-catch-log-ivl7.onrender.com/privacy |

The iOS StoreKit product ids (`com.tidemark.logbook.plan.annual` and the legacy yearly/monthly ids) are unchanged and are not sold on Android.

## What the app does

- Purchase, a 1-month free-trial offer when Play says the account is eligible, restore, and acknowledge.
- Paywall copy matches iOS (price, trial line, required line, subscribe button, Restore Purchases) with Google Play wording instead of Apple ID / App Store.
- After the trial, logging requires the subscription. Past catches stay visible.
- The website and Tide Mark 1.0 stay open. They do not send the user-agent marker.

## Server verification

`POST /api/entitlement/play` checks the signed-in journal, then:

1. If `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` is unset and both `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY` are unset, verification is **off**. The purchase token from the device is stored as active for the expiry the device sent, or **365 days** when the device has no expiry. The response says `verification: "unconfigured"`. The app does not crash.
2. If those vars are set, the server calls Google Play Developer API `purchases.subscriptionsv2` and stores only that result. A failed call does not grant the plan.
3. A half-set email/key pair, or JSON that cannot be read, returns an error and does not grant the plan.

Active, in grace, and canceled-but-not-expired subscriptions count as entitled. Paused, on hold, pending, and expired do not.

Play Billing on the device does not return the subscription expiry. Real expiry starts when the service account is set. Until then, a successful Play purchase is trusted for up to a year and is refreshed whenever the app resumes and still sees the purchase.

Set the vars on Render (the live site the WebView loads), not only in Codemagic. Package name defaults to `com.tidemark.logbook`. Override with `GOOGLE_PLAY_PACKAGE_NAME` only if that id changes.

## Permissions

Same purpose as iOS. The sentences live in `android/app/src/main/res/values/strings.xml`.

| Permission | Why |
| --- | --- |
| `CAMERA` | Photograph a catch |
| `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` | Pin the catch on the map |
| None for photos | Past catch photos come from the system photo picker (WebView file chooser). Broad media/storage permissions are stripped with `tools:node="remove"` (Play Photo and Video Permissions policy). |
| `com.android.vending.BILLING` | Tide Mark Plan |

Camera and GPS are not required hardware, so a device without them can still install.

## Icons

Adaptive icon and splash come from the locked seal: `resources/icon.png` and `resources/splash.png`. Background `#040a13`. Do not redraw the seal.

## Codemagic `android-release`

`codemagic.yaml` builds a signed release AAB and APK on a Linux machine with Java 21. It does **not** publish to Google Play.

The workflow expects a Codemagic Android code signing identity named **`tidemark_upload`**. That sets `CM_KEYSTORE_PATH`, `CM_KEYSTORE_PASSWORD`, `CM_KEY_ALIAS`, and `CM_KEY_PASSWORD`. Without that identity the workflow cannot sign. Release signing in Gradle turns on only when `CM_KEYSTORE_PATH` is set, so a local `bundleDebug` / `assembleDebug` still builds.

## What John sets up before any upload

Do these in order. This repo does not do them.

1. **Google Play Console app.** Create the app named Tide Mark. Package name must be `com.tidemark.logbook`. It cannot be changed after the first upload. Turn on **Play App Signing**. Google holds the app signing key. The Codemagic keystore is only the **upload key**.
2. **Upload keystore.** Create it locally, for example `keytool -genkeypair -v -keystore tidemark-upload.jks -alias tidemark -keyalg RSA -keysize 2048 -validity 10000`. Store the passwords somewhere safe. Do not commit the file. In Codemagic, add an Android code signing identity named exactly `tidemark_upload` and upload that keystore. If you lose the upload key later, Play App Signing can reset it; you still need the passwords until then.
3. **Subscription.** Monetize → Products → Subscriptions. Product id `tidemark_plan_yearly`. Base plan id `yearly`, billing period 1 year, price $19.99 USD (and any other countries you want). Add an offer id `free-month` on that base plan: free trial, 1 month. Activate the base plan and the offer. The app prefers `free-month` when Play returns it for that account, and otherwise buys the yearly base plan.
4. **License testers.** Play Console → Settings → License testing. Add the Gmail accounts that will buy in the license-test track so the trial and renewals can be tested without a real charge.
5. **Service account for verification.** In Google Cloud, enable **Google Play Android Developer API**. Create a service account and a JSON key. In Play Console → Users and permissions, invite that service account email and grant access to this app with permission to view financial data and manage orders and subscriptions. Put the JSON in Render as `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, or split it into `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY`. Until that is set, Android purchases are stored unverified.
6. **Store listing.** Privacy policy `https://fishing-catch-log-ivl7.onrender.com/privacy`. Terms `https://fishing-catch-log-ivl7.onrender.com/terms`. Data safety: account email, photos, precise location, and friend sharing, matching the privacy page. No photo permission to declare (system photo picker); declare location (catch pin).
7. **Codemagic.** On branch `cursor/fishing-catch-log-app-caca` (after this merges), start the `android-release` workflow. Download the AAB from the artifacts. Upload that AAB yourself in Play Console when you are ready. Do not add a Play publishing step to the workflow until you want that.

A local debug AAB and APK only prove the project compiles. They are not the file you upload. Play requires the signed release AAB from the keystore in step 2.
