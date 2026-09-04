# Native icon / splash sources

Do **not** regenerate the Tide Mark copper seal.

On a Mac, copy these existing files (same pixels, new filename only) before `npx @capacitor/assets generate`:

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

See [docs/app-store.md](../docs/app-store.md).
