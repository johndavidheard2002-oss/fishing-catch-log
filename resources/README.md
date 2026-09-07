# Native icon / splash sources

Do **not** redraw the Tide Mark copper seal. The 1024 master
(`public/brand/tide-mark-logo.png`, copied to
`ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
and `resources/icon.png`) is the locked artwork: the circular seal
fills the square, and the original trout-wash texture sits in the
corners. Do not swap in a flat teal (or any other) corner fill.

On a Mac, these copies are already in place before `npx @capacitor/assets generate`:

| Capacitor expects | Copy from |
| --- | --- |
| `resources/icon.png` | `public/brand/tide-mark-logo.png` |
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
