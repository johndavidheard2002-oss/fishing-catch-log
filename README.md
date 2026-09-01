# Cast Log

Personal fishing journal. Log a catch with a photo, remember the weather and spot, then look back and find days that felt like this one.

This is a single-angler notebook — not a social network. Species ID is an assist you can edit.

## Run

```bash
npm install
cp .env.example .env.local   # optional — demo mode works with empty keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first launch creates `data/cast-log.sqlite` and seeds example catches across Lake Travis, Frying Pan, Mosquito Lagoon, a farm pond, Lake Erie, and Chesapeake — different weather, seasons, and times of day so filters work immediately.

```bash
npm test          # similarity / filter / time-of-day unit tests
npm run build && npm start
```

Phone: add to home screen from the browser. The app is a PWA (standalone display, service worker for the shell). A later Capacitor/React Native wrap can reuse the same mobile-first routes.

## Where API keys go

Copy `.env.example` to `.env.local` in the project root:

| Variable | What it does | If missing |
| --- | --- | --- |
| `OPENWEATHER_API_KEY` | Current weather at the catch (temp, sky, wind, precip, humidity) from [OpenWeather](https://openweathermap.org/api) | Deterministic demo weather from date + coordinates. Editable. |
| `OPENAI_API_KEY` | Fish species assist from the photo (OpenAI vision) | Demo guess from a species list, clearly labeled. Editable. |
| `OPENAI_VISION_MODEL` | Optional model name (default `gpt-4o-mini`) | — |
| `DATABASE_PATH` | Optional SQLite file path | `./data/cast-log.sqlite` |

Place names use OpenStreetMap Nominatim (no key). GPS comes from the browser, or from photo EXIF if you upload from the camera roll.

The header shows **Demo APIs** when weather or vision is not live.

## What you can do

- **Log** — big camera/upload, fast save. On save we capture photo, species assist, lat/long + place, weather, timestamp, dawn/morning/afternoon/dusk/night, season, plus optional bait / tide / water / notes.
- **History** — grid or list, filters for species, place, date range, season, time of day, sky, temp band, wind band. Presets like “Cloudy 70–80°F”. CSV export.
- **Similar to this catch** — ranks past logs by species, spot, season, time of day, sky, temperature, and wind, and says why.
- **Spots** — map + grouped list so you can revisit water that produced under similar conditions.

Everything is editable if GPS, weather, or vision fail.

## Data

SQLite via Drizzle (`data/cast-log.sqlite`). User photos land in `data/uploads/` (gitignored). Seed illustrations live in `public/seed/`.

Delete the `data/` folder to reset the journal and re-seed.

## Stack

Next.js (App Router) · TypeScript · Tailwind · SQLite · Leaflet (OSM tiles, no map key)

Vision and weather sit behind small interfaces in `src/lib/vision` and `src/lib/weather` so another provider can be swapped later.
