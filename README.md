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

Phone: add to home screen from the browser. The app is a PWA (standalone display, service worker for the shell). A later Capacitor/React Native wrap can reuse the same mobile-first routes, including writing catch photos straight to the camera roll. In the browser, **Save to Photos** uses the share sheet or a download — iPhone may ask you to tap Save Image.

**Find fishing photos in your library** ships with every Catch Compass journal — not a developer extra. Each angler chooses pictures from *their* phone, Catch Compass looks for fish, and they confirm each one onto *their* calendar. Only that person’s selected photos are processed. The browser cannot silently scan the whole camera roll; a later native wrap can offer a fuller scan on the same product path.

## Where API keys go

Copy `.env.example` to `.env.local` in the project root:

| Variable | What it does | If missing |
| --- | --- | --- |
| `OPENWEATHER_API_KEY` | Current weather at the catch **and** 5-day forecast on Plan, from [OpenWeather](https://openweathermap.org/api): sky, temp, **wind speed + direction**, **barometric pressure**. Past dates use Open-Meteo archive (no key) including wind dir, pressure, and a 3-hour pressure trend when possible. Moon phase is always computed from the catch date. | Deterministic demo sky/wind/pressure from date + coordinates, labeled demo. Moon phase is still real from the date. Everything is editable. |
| `OPENAI_API_KEY` | **Real** fish species assist from the photo (OpenAI vision). Uses `gpt-4o` by default, the US/Gulf catalog, and habitat/location hints. Shows confidence; auto-fills the species field only at ≥50% confidence. Always editable. | Demo guess from the **habitat-filtered** catalog (not a mixed FW+salt list). Clearly labeled demo, usually low confidence so it does not overwrite the species field. Pick a chip or type the name. |
| `OPENAI_VISION_MODEL` | Optional model override (default `gpt-4o`). `gpt-4o-mini` is cheaper and faster but weaker on similar inshore species. | — |
| `WORLDTIDES_API_KEY` | Tide extremes for coastal spots on Plan ([WorldTides](https://www.worldtides.info/)) | Synthetic semidiurnal tide series, labeled demo. Inland spots skip tides unless you logged a tide on a catch there. |
| `DATABASE_PATH` | Optional SQLite file path | `./data/cast-log.sqlite` |

Place names use OpenStreetMap Nominatim (no key). GPS comes from the browser, or from photo EXIF if you upload from the camera roll.

The header shows **Demo APIs** when weather or vision is not live.

## What you can do

- **Home** — log a catch, backfill a past catch, plan the next few days, calendar, and Spots. Journal counts live here; catch browsing stays on History. Buddy linking sits under **More**.
- **Log** — camera for a catch happening now. Fast save. Set **how many fish** (default 1; tagging two species starts at two). Pick **Freshwater / Saltwater**, then **Inshore / Offshore** for salt, so the species list stays short. **Tag every species in the photo** — one catch can have more than one fish. Vision can suggest more than one; you add or remove chips. **Catch location** is always editable after the photo (pin the water, not the cooler/truck). Photo GPS is stored separately when it differs. Weather, GPS, and place fill in when they can — including **moon phase**, **wind direction**, and **barometric pressure** (inHg and mb, with trend when we have it). Optional bait / tide / water / notes. **Share with linked buddies** is off unless you turn it on.
- **Backfill** — its own tab, separate from live Log. Add one past trip from the camera roll (date/time + map pin), or **Find fishing photos in your library**. Import old trips from this phone. Choose photos (or a folder on this device). Skip shots that do not look like fish, then **Add to log?** for each one. Photo time is used when the picture has it, and it is editable. Yes opens the backfill form; after save, History opens on that day. Remaining photos stay queued. Nothing is added until you confirm. Only your selected photos are processed. The browser cannot silently scan the whole camera roll.
- **History** — grid, list, or **calendar** month view. Day cells show stacked catch photos (and +N). Tap a day for that day’s trips in time order, each with its own spot — two lakes in one day stay two pins. Filter by freshwater / saltwater / inshore / offshore, moon phase, wind direction, and pressure trend. Presets like “Cloudy 70–80°F” and “Full moon”. CSV export.
- **Save to Photos** — included for every buyer. On catch detail, History cards, the log preview, and Plan trip photos, save the catch image to this phone. The browser uses the share sheet when it can (iPhone: pick **Save Image** / **Add to Photos**) or a download. Android usually lands in Downloads, then the gallery. A later native wrap can write straight to the camera roll. Never auto-saves; you tap it. Filenames include species and date.
- **Similar to this catch** — ranks past logs by species, spot, season, time of day, sky, temperature, wind (speed + direction), moon, and pressure, and says why.
- **Plan** — upcoming 3/5/7-day windows vs days you actually caught fish. Photos on Plan cards are **only your logged trip photos** — no seed art or stock. Honest that this is a pattern match, not a guarantee.
- **Spots** — map + grouped list so you can revisit water that produced under similar conditions. Distinct pins stay distinct even on the same calendar day; editing one catch’s location does not move the others. Each spot shows **how many fish** and how many trips.
- **Linked buddies** — invite code pairing (or a household profile on this journal), from Home → More. Combined History / Plan / Spots can include trips a buddy **explicitly shared**, labeled with whose catch it is. **Only shared with people you’ve linked.** Never public: no feed, no discoverable profile, no share-with-everyone. Unapproved people see nothing. Unlink anytime. Entire histories are never auto-shared.

### How linking works (v1 vs production)

v1 is invite codes plus optional household profiles on this SQLite journal so two anglers can be demoed on one phone. Production auth (magic link / email accounts) should replace the profile switcher only: each signed-in angler still has an invite code, still accepts a buddy, and still shares **per trip**. A shared server database is what lets two phones pair. Unapproved users never see another angler’s data.

Everything is editable if GPS, weather, or vision fail.

## Data

SQLite via Drizzle (`data/cast-log.sqlite`). User photos land in `data/uploads/` (gitignored). Seed illustrations live in `public/seed/`.

Delete the `data/` folder to reset the journal and re-seed.

## Stack

Next.js (App Router) · TypeScript · Tailwind · SQLite · Leaflet (OSM tiles, no map key)

Vision, weather, forecast, and tides sit behind small interfaces in `src/lib/vision`, `src/lib/weather`, and `src/lib/tides` so another provider can be swapped later.
