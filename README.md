# Catch Compass

**Automatic Logbook.** Personal fishing journal. Log a catch with a photo, remember the weather and spot, then look back and find days that felt like this one.

This is a single-angler notebook — not a social network. Species ID is an assist you can edit.

## Run

```bash
npm install
cp .env.example .env.local   # optional — demo mode works with empty keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first launch creates `data/cast-log.sqlite` and seeds example catches across Lake Travis, Frying Pan, Mosquito Lagoon, a farm pond, Lake Erie, Chesapeake, and the Gulf Stream — freshwater, inshore, and offshore, plus different weather, seasons, and times of day so filters work immediately.

```bash
npm test          # similarity / filter / time-of-day / plan / calendar unit tests
npm run build && npm start
```

Phone: add to home screen from the browser. The app is a PWA (standalone display, service worker for the shell). A later Capacitor/React Native wrap can reuse the same mobile-first routes.

## Where API keys go

Copy `.env.example` to `.env.local` in the project root:

| Variable | What it does | If missing |
| --- | --- | --- |
| `OPENWEATHER_API_KEY` | Current weather at the catch **and** 5-day forecast on Plan, from [OpenWeather](https://openweathermap.org/api) | Deterministic demo weather/forecast from date + coordinates. Labeled demo. |
| `OPENAI_API_KEY` | Fish species assist from the photo (OpenAI vision) | Demo guess from a species list, clearly labeled. Editable. |
| `OPENAI_VISION_MODEL` | Optional model name (default `gpt-4o-mini`) | — |
| `WORLDTIDES_API_KEY` | Tide extremes for coastal spots on Plan ([WorldTides](https://www.worldtides.info/)) | Synthetic semidiurnal tide series, labeled demo. Inland spots skip tides unless you logged a tide on a catch there. |
| `DATABASE_PATH` | Optional SQLite file path | `./data/cast-log.sqlite` |

Place names use OpenStreetMap Nominatim (no key). GPS comes from the browser, or from photo EXIF if you upload from the camera roll.

The header shows **Demo APIs** when weather or vision is not live.

## What you can do

- **Log** — camera or camera-roll upload, fast save. Pick **Freshwater / Saltwater**, then **Inshore / Offshore** for salt, so the species list stays short. Weather, GPS, and place fill in when they can. Optional bait / tide / water / notes. **Share with linked buddies** is off unless you turn it on.
- **Add a past catch** — backfill from an old photo: set the date/time, drop a map pin, search a place, and we try archive weather for that day.
- **History** — grid, list, or **calendar** month view. Day cells show stacked catch photos (and +N). Tap a day for that day’s trips in time order. Filter by freshwater / saltwater / inshore / offshore. Presets like “Cloudy 70–80°F”. CSV export.
- **Similar to this catch** — ranks past logs by species, spot, season, time of day, sky, temperature, and wind, and says why.
- **Plan** — upcoming 3/5/7-day windows vs days you actually caught fish. Photos on Plan cards are **only your logged trip photos** — no seed art or stock. Honest that this is a pattern match, not a guarantee.
- **Spots** — map + grouped list so you can revisit water that produced under similar conditions.
- **Linked buddies** — invite code pairing (or a household profile on this journal). Combined History / Plan / Spots can include trips a buddy **explicitly shared**, labeled with whose catch it is. **Only shared with people you’ve linked.** Never public: no feed, no discoverable profile, no share-with-everyone. Unapproved people see nothing. Unlink anytime. Entire histories are never auto-shared.

### How linking works (v1 vs production)

v1 is invite codes plus optional household profiles on this SQLite journal so two anglers can be demoed on one phone. Production auth (magic link / email accounts) should replace the profile switcher only: each signed-in angler still has an invite code, still accepts a buddy, and still shares **per trip**. A shared server database is what lets two phones pair. Unapproved users never see another angler’s data.

Everything is editable if GPS, weather, or vision fail.

## Data

SQLite via Drizzle (`data/cast-log.sqlite`). User photos land in `data/uploads/` (gitignored). Seed illustrations live in `public/seed/`.

Delete the `data/` folder to reset the journal and re-seed.

## Stack

Next.js (App Router) · TypeScript · Tailwind · SQLite · Leaflet (OSM tiles, no map key)

Vision, weather, forecast, and tides sit behind small interfaces in `src/lib/vision`, `src/lib/weather`, and `src/lib/tides` so another provider can be swapped later.
