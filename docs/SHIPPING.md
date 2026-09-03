# Shipping Catch Compass

Personal **Saltwater Logbook**. This is the durable-hosting path: keep the local SQLite demo, optionally point the same Drizzle schema at Turso (LibSQL) for a hosted journal.

## Local SQLite (default)

No extra accounts. From the repo:

```bash
npm install
npm run dev
```

Creates `./data/cast-log.sqlite` and stores catch/bait photos in `./data/uploads/` (gitignored). Override the file with `DATABASE_PATH` if you want a different journal on disk.

This is the right mode for a laptop, a always-on Node host with a disk, or the Cloudflare/phone demo rebuilds you already use.

## Turso / LibSQL (durable remote DB)

Use this when the host’s filesystem is ephemeral (Phone Cloudflare demo, many PaaS rebuilds) or when you want the journal to survive deploys.

1. Create a **free** database at [Turso](https://turso.tech) (`turso db create catch-compass` if you use the CLI).
2. Copy the URL and token into `.env.local` (or the host’s env UI):

```bash
# Wins over DATABASE_PATH when set
TURSO_DATABASE_URL=libsql://catch-compass-<org>.turso.io
TURSO_AUTH_TOKEN=...

# Optional aliases
# DATABASE_URL=libsql://...          # also switches to LibSQL if it looks like libsql/https/wss
# LIBSQL_AUTH_TOKEN=...              # used if TURSO_AUTH_TOKEN is empty
```

Same schema as local SQLite. First request creates tables and a default angler. A postgres `DATABASE_URL` is ignored so a copied PaaS template does not silently switch drivers.

Leave `TURSO_*` unset to stay on `./data/cast-log.sqlite`.

## Photos / uploads

| Mode | Where files live |
| --- | --- |
| Local SQLite | `data/uploads/` on this machine (`UPLOADS_DIR` to override) |
| Turso on a host with disk | Same: keep `UPLOADS_DIR` (or `data/uploads`) on **that** host. The DB stores the filename; `/api/media/...` reads the file. |
| Turso + no durable disk (typical Vercel serverless) | File uploads will not survive. Store a reachable `http(s)` URL in `photo_path` (object storage you already have), or run the Node app on a small VPS so `UPLOADS_DIR` is real disk. This repo does not create a paid bucket. |

`photoSrc()` already treats `http://` and `https://` paths as remote URLs.

## Weather and tides

Optional. The app runs in labeled demo mode without keys.

| Variable | Used for |
| --- | --- |
| `OPENWEATHER_API_KEY` | Live sky/wind/pressure at the pin + Plan forecast ([OpenWeather](https://openweathermap.org/api)) |
| `WORLDTIDES_API_KEY` | Worldwide tide extremes ([WorldTides](https://www.worldtides.info/)). US coasts still use free NOAA CO-OPS without a key. |

## PWA

Already wired. `AppShell` registers `/sw.js` for the installable shell. Add to Home Screen from the browser; no extra shipping step.

## Hosting notes

- **Vercel serverless + file SQLite** is a poor fit: the sqlite file and `data/uploads` live on an ephemeral lambda disk and vanish between deploys. Use **Turso** for the journal, and either a host with disk for photos or later object storage.
- A cheap always-on Node box (`npm run build && npm start`) can keep using local SQLite + local uploads with no Turso at all.
- Do not commit `.env.local` or `data/`.

Next on the ship path (not this change): live weather/tides polish, then PWA extras. Not this change: creating Turso/Vercel accounts, social features, Capacitor wrap.
