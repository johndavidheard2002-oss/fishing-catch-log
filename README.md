# Catch Compass

**Automatic Logbook.** Personal fishing journal. Log a catch with a photo, remember the weather and spot, then look back and find days that felt like this one.

This is a single-angler notebook — not a social network. You pick every species from the list.

## Run

```bash
npm install
cp .env.example .env.local   # optional — demo mode works with empty keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first launch creates an **empty** journal (`data/cast-log.sqlite`). Your Calendar Log and Spots stay empty until you log or backfill a catch — one photo is one trip at one pin. Optional example trips (Lake Travis, Frying Pan, Mosquito Lagoon, and more) load only from Home → More → **Load sample catches**. They are labeled Sample and can be removed the same way.

```bash
npm test          # similarity / filter / time-of-day / plan / calendar unit tests
npm run build && npm start
```

Phone: add to home screen from the browser. The app is a PWA (standalone display, service worker for the shell). A later Capacitor/React Native wrap can reuse the same mobile-first routes, including writing catch photos straight to the camera roll. In the browser, **Save to Photos** uses the share sheet or a download — iPhone may ask you to tap Save Image.

**Find fishing photos in your library** ships with every Catch Compass journal — not a developer extra. Each angler chooses pictures from *their* phone and confirms each one onto *their* calendar. Species is tagged by hand. Only that person’s selected photos are processed. The browser cannot silently scan the whole camera roll; a later native wrap can offer a fuller scan on the same product path.

## Where API keys go

Copy `.env.example` to `.env.local` in the project root:

| Variable | What it does | If missing |
| --- | --- | --- |
| `OPENWEATHER_API_KEY` | Current weather at the catch **and** 5-day forecast on Plan, from [OpenWeather](https://openweathermap.org/api): sky, temp, **wind speed + direction**, **barometric pressure**. Past dates use Open-Meteo archive (no key) including wind dir, pressure, and a 3-hour pressure trend when possible. Moon phase is always computed from the catch date. | Deterministic demo sky/wind/pressure from date + coordinates, labeled demo. Moon phase is still real from the date. Everything is editable. |
| `OPENAI_API_KEY` | Parked. Species auto-ID is off — you pick fish from the list. | Unused. |
| `OPENAI_VISION_MODEL` | Parked with species auto-ID. | — |
| `WORLDTIDES_API_KEY` | Optional worldwide tide extremes on the log form and Plan ([WorldTides](https://www.worldtides.info/)) | Catch weather uses free [NOAA CO-OPS](https://tidesandcurrents.noaa.gov/) stations on US coasts (no key). No invented ocean tides on freshwater or inland pins. Plan still uses a labeled demo series when this key is missing. |
| `DATABASE_PATH` | Optional SQLite file path | `./data/cast-log.sqlite` |

Place names use OpenStreetMap Nominatim (no key). GPS comes from the browser, or from photo EXIF if you upload from the camera roll.

The header shows **Demo APIs** when weather, forecast, or tides are not live.

## What you can do

- **Home** — log a catch, backfill a past catch, plan the next few days, Calendar Log, and Spots. Journal counts live here; catch browsing stays on Calendar Log. A new journal is **empty** (no sample lakes). Buddy linking and optional **Load sample catches** sit under **More**.
- **Log** — camera for a catch happening now. Fast save. Set **how many fish** (default 1). Tag two or more species and count each kind (Redfish 2, Trout 1). Water type starts on **Saltwater → Inshore** (Freshwater and Offshore stay a tap away) so the species list stays short. **Tag every species in the photo** yourself — one catch can have more than one fish. No automatic species guess. **Catch location:** a photo with a GPS stamp auto-drops a pin on a **satellite** map (still draggable — the picture may be the truck or dock). Switch to street tiles if you want. No GPS in the photo uses this phone’s location if allowed, otherwise an empty map for you to tap. Moving the pin is sticky: re-saving the same photo will not jump it back. Photo GPS is stored separately when it differs. Weather and place fill in when they can — including **moon phase**, **wind direction**, **barometric pressure** (inHg and mb, with trend when we have it), and **tides** on saltwater (stage, height, next high/low from the pin + catch time; NOAA CO-OPS, or WorldTides if you add a key). Freshwater shows no tide. The **catch clock** (e.g. 6:42 AM) comes from the photo’s EXIF time or the time you log; Calendar Log shows that clock, not a morning/afternoon label. Optional bait / water / notes. **Share with linked buddies** is off unless you turn it on.
- **Backfill** — its own tab, separate from live Log. Add one past trip from the camera roll (date/time + map pin), or **Find fishing photos in your library**. Import old trips from this phone. Choose photos (or a folder on this device), then **Add to log?** for each one — you pick the species; nothing is auto-identified. Photo time is used when the picture has it, and it is editable — Calendar Log shows that **clock time** (e.g. 6:42 AM). Each entry keeps its **own catch pin** (auto-placed from photo GPS when present, still movable; no device “here now” for past trips) — two photos from the same day can be two lakes. Yes opens the backfill form; after save, Calendar Log opens on that day. Remaining photos stay queued. Nothing is added until you confirm. Only your selected photos are processed. The browser cannot silently scan the whole camera roll.
- **Calendar Log** — primary bottom tab (`/calendar`; `/history` redirects here). Opens on the **month calendar** (day cells show stacked catch photos and +N). Tap a day for that day’s trips in time order, each with its own spot — two lakes in one day stay two pins. Switch to **List** or **Grid** for the old History browse modes. Filter by freshwater / saltwater / inshore / offshore, time of day (derived from the catch clock), moon phase, wind direction, and pressure trend. Presets like “Cloudy 70–80°F” and “Full moon”. No season filters. CSV export.
- **Save to Photos** — included for every buyer. On catch detail, Calendar Log cards, the log preview, and Plan trip photos, save the catch image to this phone. The browser uses the share sheet when it can (iPhone: pick **Save Image** / **Add to Photos**) or a download. Android usually lands in Downloads, then the gallery. A later native wrap can write straight to the camera roll. Never auto-saves; you tap it. Filenames include species and date.
- **Similar to this catch** — ranks past logs by species, spot, time of day, sky, temperature, wind (speed + direction), moon, and pressure, and says why.
- **Plan** — upcoming 3/5/7-day windows vs days you actually caught fish. Photos on Plan cards are **only your logged trip photos** — no seed art or stock. Honest that this is a pattern match, not a guarantee.
- **Spots** — satellite map + grouped list so you can revisit water that produced under similar conditions. Distinct pins stay distinct even on the same calendar day; editing one catch’s location does not move the others. Each spot shows **how many fish** (with a species split when more than one kind) and how many trips.
- **Linked buddies** — invite code pairing (or a household profile on this journal), from Home → More. Combined Calendar Log / Plan / Spots can include trips a buddy **explicitly shared**, labeled with whose catch it is. **Only shared with people you’ve linked.** Never public: no feed, no discoverable profile, no share-with-everyone. Unapproved people see nothing. Unlink anytime. Entire histories are never auto-shared.

### How linking works (v1 vs production)

v1 is invite codes plus optional household profiles on this SQLite journal so two anglers can be demoed on one phone. Production auth (magic link / email accounts) should replace the profile switcher only: each signed-in angler still has an invite code, still accepts a buddy, and still shares **per trip**. A shared server database is what lets two phones pair. Unapproved users never see another angler’s data.

Everything is editable if GPS or weather fail. Species is always yours to tag.

## Data

SQLite via Drizzle (`data/cast-log.sqlite`). User photos land in `data/uploads/` (gitignored). Seed illustrations live in `public/seed/`.

Delete the `data/` folder to reset the journal and re-seed.

## Stack

Next.js (App Router) · TypeScript · Tailwind · SQLite · Leaflet (**Esri World Imagery** satellite by default, OSM streets as a toggle — no map key)

Vision, weather, forecast, and tides sit behind small interfaces in `src/lib/vision`, `src/lib/weather`, and `src/lib/tides` so another provider can be swapped later.
