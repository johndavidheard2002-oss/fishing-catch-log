# Native icon / splash sources

Do **not** redraw the Tide Mark copper seal. The locked masters are:

- In-app / PWA: `public/brand/tide-mark-logo.png` — circular copper
  ring, **TIDE MARK** on top, **SALTWATER LOGBOOK** on the bottom,
  orange-amber fish-eye in the map pin.
- iOS App Store: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
  (copied to `resources/icon.png`) — the same seal on an opaque
  near-black 1024 square. No alpha channel.

On a Mac, these copies are already in place before `npx @capacitor/assets generate`:

| Capacitor expects | Copy from |
| --- | --- |
| `resources/icon.png` | iOS AppIcon 1024 (opaque) |
| `resources/splash.png` | `public/brand/tide-mark-logo.png` |

Background color for generate: `#040a13` (matches the PWA theme).

Also already shipped for the web / PWA:

- `public/icon-192.png`
- `public/icon-512.png`
- `public/apple-icon.png`
- `public/splash/apple-splash-*.png`

The iPhone home-screen / TestFlight icon is the native AppIcon. A
Render web deploy does **not** update it — run the Codemagic
`ios-testflight` workflow so the next IPA picks up this asset.

See [docs/app-store.md](../docs/app-store.md).
