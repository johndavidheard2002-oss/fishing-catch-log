# Shipping Catch Compass

**Catch Compass** is a personal **Saltwater Logbook**. Wait to share a URL until a real host is up. A Cloudflare quick tunnel is demo-only.

## Recommended path

**Turso** for the journal + a host with **persistent disk** for catch photos.

Prefer **Render** or **Railway** over **Vercel serverless**. Vercel’s lambda disk is ephemeral: uploads vanish, and file SQLite is a poor fit. Turso keeps the log; the disk keeps the pictures.

This repo does not create those accounts. Free Turso DB is enough. Use a Render/Railway plan that includes a disk (starter is typical; skip paid add-ons you do not need).

## First-time checklist (~10 minutes)

### 1. Turso (journal) — ~3 min

1. Sign up at [turso.tech](https://turso.tech) and create a free database named `catch-compass` (dashboard is fine).
2. Or CLI:

```bash
turso db create catch-compass
turso db show catch-compass --url
turso db tokens create catch-compass
```

3. Copy the URL (`libsql://…`) and the token. Paste them only into the host env UI (or local `.env.local`). Do not commit them.

First request on the host creates tables and a default angler. Same Drizzle schema as local SQLite.

### 2. OpenWeather — ~2 min

1. Get a key at [OpenWeather](https://openweathermap.org/api) (current weather + 5-day forecast; free tier is enough).
2. Optional worldwide tides: [WorldTides](https://www.worldtides.info/). US coasts still use free NOAA CO-OPS with no key.

Skip these and the app still runs, labeled **Demo APIs**.

### 3. Render or Railway (app + photo disk) — ~5 min

Node **20+**. Build and start:

```bash
npm ci && npm run build && npm start
```

`npm start` is `next start`. It reads **`PORT`** from the environment (Render/Railway set this; default 3000). It already listens on `0.0.0.0`.

**Disk:** attach a persistent volume and mount it at `/var/data`. Then set `UPLOADS_DIR=/var/data/uploads`. Only files under that mount survive deploys.

#### Render

1. New **Web Service** from this GitHub repo (`fishing-catch-log`).
2. Build command: `npm ci && npm run build`
3. Start command: `npm start`
4. Advanced → **persistent disk**, mount path `/var/data` (smallest size).
5. Paste the env vars below. Deploy.

#### Railway

1. New project from the same GitHub repo.
2. Add a **volume**, mount `/var/data`.
3. Build/start as above (`npm ci && npm run build` then `npm start`), or Railway’s Node defaults if they run those scripts.
4. Paste the env vars below. Deploy.

### 4. Env vars on the host (exact)

Paste these in the host’s environment UI:

| Name | Required? | Value |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | **Yes** | `libsql://…` from Turso |
| `TURSO_AUTH_TOKEN` | **Yes** | token from Turso |
| `NODE_ENV` | **Yes** | `production` |
| `OPENWEATHER_API_KEY` | Recommended | OpenWeather key |
| `WORLDTIDES_API_KEY` | Optional | WorldTides key |
| `UPLOADS_DIR` | **Yes on Render/Railway** | `/var/data/uploads` (must sit on the disk mount) |

Leave **unset** (the host provides or the app defaults):

- `PORT` — Render/Railway set this. Do not hardcode `3000` on the host.
- `DATABASE_PATH` — local file only; Turso wins when `TURSO_DATABASE_URL` is set.
- A postgres `DATABASE_URL` — ignored on purpose so a copied PaaS template does not switch drivers.

`DATABASE_URL=libsql://…` also works as a Turso alias; `TURSO_DATABASE_URL` wins if both are set.

### 5. Smoke (before you share)

1. Open the public `https://…` URL.
2. Header should read **Catch Compass** / **Saltwater Logbook**.
3. Log a catch with a **photo**, reload: the trip and the picture should still be there.
4. Redeploy once and confirm the photo is still there (proves the disk, not just Turso).

Do not share until that URL is the one you mean to keep.

## Do not use as the real journal

- **Cloudflare quick tunnel** — phone/demo only. Ephemeral. Not a host to send to anyone.
- **Vercel serverless** — no durable disk for `data/uploads`; file SQLite will not survive. Use Turso + Render/Railway instead.
- Laptop `npm run dev` / `localhost:3000` — fine for you, not a share link.

## Local laptop (unchanged)

```bash
npm install
npm run dev
```

Creates `./data/cast-log.sqlite` and `./data/uploads/` (gitignored). Leave `TURSO_*` unset. Optional: `DATABASE_PATH`, `UPLOADS_DIR`.

A cheap always-on Node box with a real disk can skip Turso and keep the sqlite file on that machine (`npm ci && npm run build && npm start`). The recommended hosted path above is still Turso + disk, so a PaaS rebuild cannot wipe the log.

## PWA

Already wired. `AppShell` registers `/sw.js`. After the real host is up, Add to Home Screen from the phone browser. No extra shipping step.

## Do not commit

`.env.local`, Turso tokens, or `data/`.

Next on the ship path (not this doc): live weather/tides polish, then PWA extras. Not this turn: creating paid accounts, social features, Capacitor wrap.
