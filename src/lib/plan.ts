import { groupBaitSpots, baitTypesLabel } from "./bait";
import { groupSpots, spotKey } from "./filters";
import { speciesLabel } from "./species";
import { formatDateOnly, formatTimeOnly, TIME_OF_DAY_LABELS } from "./time";
import { conditionLabel, scoreConditionOverlap, suggestionStrength } from "./similar";
import { getTideSeries, hasWorldTidesKey } from "./tides";
import type {
  BaitPlanSuggestion,
  BaitSpot,
  BaitSpotGroup,
  CatchRecord,
  ForecastWindow,
  MatchStrength,
  PlanMatch,
  PlanResult,
  PlanSuggestion,
  SpotGroup,
  TimeOfDay,
} from "./types";
import { echoPastWindow, getForecastWindows } from "./weather/forecast";
import { hasOpenWeatherKey } from "./weather";

const MIN_SCORE = 22;
const MAX_MATCHES = 3;

export function isPositiveCatch(record: CatchRecord): boolean {
  const names = record.speciesList?.length ? record.speciesList : [record.species];
  return names.some((s) => {
    const species = s.trim().toLowerCase();
    return Boolean(species) && !["unknown", "none", "skunk", "no fish", "empty"].includes(species);
  });
}

export { suggestionStrength };

export function planHeadline(window: ForecastWindow, match: CatchRecord): string {
  const bits: string[] = [];
  if (window.weatherCondition) bits.push(conditionLabel(window.weatherCondition).toLowerCase());
  if (window.temperatureF != null) bits.push(`${Math.round(window.temperatureF)}°F`);
  bits.push(window.timeOfDay);
  if (window.tide) bits.push(`${window.tide} tide`);
  const place = match.placeName || "this water";
  return `${bits.join(" + ")} like your ${speciesLabel(match.speciesList?.length ? match.speciesList : match.species)} at ${place} on ${formatDateOnly(match.caughtAt)}`;
}

/** Time-of-day bucket, plus the forecast clock on very-strong windows. */
export function forecastWindowWhenLabel(
  window: ForecastWindow,
  strength: MatchStrength,
): string {
  const tod = TIME_OF_DAY_LABELS[window.timeOfDay];
  if (strength !== "very-strong" || !window.at) return tod;
  const date = new Date(window.at);
  if (Number.isNaN(date.getTime())) return tod;
  return `${tod} · ${formatTimeOnly(window.at)}`;
}

/** 1–3 short why chips for Strong / Very strong Plan cards. */
export function planWhyChips(args: {
  reasons: string[];
  strength: MatchStrength;
  placeName?: string | null;
  species?: string | null;
  timeOfDay?: TimeOfDay | null;
  windowAt?: string | null;
}): string[] {
  if (args.strength !== "strong" && args.strength !== "very-strong") {
    return args.reasons.filter(Boolean).slice(0, 3);
  }
  const raw = args.reasons.filter(Boolean);
  const chips: string[] = [];
  const take = (test: (reason: string) => boolean) => raw.find(test);

  const tide = take((reason) => /tide/i.test(reason));
  if (tide) chips.push(prettyPlanWhy(tide, args.timeOfDay));

  const clock =
    args.strength === "very-strong" && args.windowAt && !Number.isNaN(new Date(args.windowAt).getTime())
      ? formatTimeOnly(args.windowAt)
      : "";
  const chipsHaveClock = Boolean(clock) && chips.some((chip) => chip.includes(clock));
  if (clock && !chipsHaveClock) {
    chips.push(`Around ${clock}`);
  }

  const tideAlreadyHasTime = Boolean(tide && /AM|PM|dawn|dusk|morning|afternoon|night/i.test(tide));
  const time = take((reason) => /time of day/i.test(reason) || /^~/i.test(reason));
  if (time && !tideAlreadyHasTime && !clock) chips.push(prettyPlanWhy(time, args.timeOfDay));

  const weather = take((reason) =>
    /sky|clear|cloud|overcast|fog|drizzle|rain|storm|snow|wet weather/i.test(reason),
  );
  if (weather) chips.push(prettyPlanWhy(weather, args.timeOfDay));

  if (chips.length < 3 && args.placeName) {
    const place = shortPlace(args.placeName);
    chips.push(args.species ? `${args.species} at ${place}` : place);
  }

  return [...new Set(chips)].slice(0, 3);
}

function prettyPlanWhy(reason: string, timeOfDay?: TimeOfDay | null): string {
  if (reason === "Same time of day" && timeOfDay) {
    return `Same ${TIME_OF_DAY_LABELS[timeOfDay].toLowerCase()}`;
  }
  if (reason === "Similar sky") return "Similar skies";
  if (/^(Clear|Cloudy|Partly cloudy|Overcast)$/i.test(reason)) {
    return `${reason} skies`;
  }
  return reason.charAt(0).toUpperCase() + reason.slice(1);
}

function shortPlace(place: string): string {
  const cut = place.split(",")[0]?.trim();
  return cut || place;
}

export function scoreWindowAgainstCatch(
  window: ForecastWindow,
  record: CatchRecord,
): PlanMatch {
  const overlap = scoreConditionOverlap(
    { ...window, clockAt: window.at },
    { ...record, clockAt: record.caughtAt },
  );
  return {
    catch: record,
    score: overlap.score,
    reasons: overlap.reasons,
    strength: suggestionStrength(overlap.score, overlap),
  };
}

export function suggestFromWindows(args: {
  spots: SpotGroup[];
  windowsBySpotKey: Record<string, ForecastWindow[]>;
  minScore?: number;
}): PlanSuggestion[] {
  const minScore = args.minScore ?? MIN_SCORE;
  const suggestions: PlanSuggestion[] = [];

  for (const spot of args.spots) {
    const windows = args.windowsBySpotKey[spot.key] ?? [];
    const history = spot.catches.filter(isPositiveCatch);
    if (!history.length) continue;

    const perDay = new Map<string, PlanSuggestion[]>();

    for (const window of windows) {
      const matches = history
        .map((record) => scoreWindowAgainstCatch(window, record))
        .filter((m) => m.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_MATCHES);
      if (!matches.length) continue;

      const best = matches[0];
      const suggestion: PlanSuggestion = {
        id: `${spot.key}|${window.date}|${window.timeOfDay}`,
        spotKey: spot.key,
        placeName: spot.placeName,
        latitude: spot.latitude,
        longitude: spot.longitude,
        window,
        score: best.score,
        strength: best.strength,
        headline: planHeadline(window, best.catch),
        reasons: best.reasons,
        matches,
      };
      const list = perDay.get(window.date) ?? [];
      list.push(suggestion);
      perDay.set(window.date, list);
    }

    for (const list of perDay.values()) {
      list
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .forEach((s) => suggestions.push(s));
    }
  }

  const ranked = suggestions.sort((a, b) => {
    const day = a.window.date.localeCompare(b.window.date);
    if (day) return day;
    return b.score - a.score;
  });

  const byDate = new Map<string, PlanSuggestion[]>();
  for (const s of ranked) {
    const list = byDate.get(s.window.date) ?? [];
    list.push(s);
    byDate.set(s.window.date, list);
  }
  return [...byDate.entries()].flatMap(([, list]) => list.slice(0, 4));
}

export function baitPlanHeadline(window: ForecastWindow, match: BaitSpot): string {
  const bits: string[] = [];
  if (window.weatherCondition) bits.push(conditionLabel(window.weatherCondition).toLowerCase());
  if (window.temperatureF != null) bits.push(`${Math.round(window.temperatureF)}°F`);
  bits.push(window.timeOfDay);
  if (window.tide) bits.push(`${window.tide} tide`);
  const place = match.placeName || "this water";
  return `${bits.join(" + ")} like your ${baitTypesLabel(match.baitTypes)} at ${place} on ${formatDateOnly(match.loggedAt)}`;
}

export function scoreWindowAgainstBait(
  window: ForecastWindow,
  record: BaitSpot,
): { baitSpot: BaitSpot; score: number; reasons: string[]; strength: PlanSuggestion["strength"] } {
  const overlap = scoreConditionOverlap(
    { ...window, clockAt: window.at },
    { ...record, clockAt: record.loggedAt },
  );
  return {
    baitSpot: record,
    score: overlap.score,
    reasons: overlap.reasons,
    strength: suggestionStrength(overlap.score, overlap),
  };
}

export function suggestBaitFromWindows(args: {
  groups: BaitSpotGroup[];
  windowsBySpotKey: Record<string, ForecastWindow[]>;
  minScore?: number;
}): BaitPlanSuggestion[] {
  const minScore = args.minScore ?? MIN_SCORE;
  const suggestions: BaitPlanSuggestion[] = [];

  for (const spot of args.groups) {
    const windows = args.windowsBySpotKey[spot.key] ?? [];
    const history = spot.spots.filter((s) => s.baitTypes.length);
    if (!history.length) continue;

    const perDay = new Map<string, BaitPlanSuggestion[]>();

    for (const window of windows) {
      const matches = history
        .map((record) => scoreWindowAgainstBait(window, record))
        .filter((m) => m.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_MATCHES);
      if (!matches.length) continue;

      const best = matches[0];
      const suggestion: BaitPlanSuggestion = {
        id: `bait|${spot.key}|${window.date}|${window.timeOfDay}`,
        spotKey: spot.key,
        placeName: spot.placeName,
        baitTypes: spot.baitTypes,
        latitude: spot.latitude,
        longitude: spot.longitude,
        window,
        score: best.score,
        strength: best.strength,
        headline: baitPlanHeadline(window, best.baitSpot),
        reasons: best.reasons,
        matches,
      };
      const list = perDay.get(window.date) ?? [];
      list.push(suggestion);
      perDay.set(window.date, list);
    }

    for (const list of perDay.values()) {
      list
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .forEach((s) => suggestions.push(s));
    }
  }

  const ranked = suggestions.sort((a, b) => {
    const day = a.window.date.localeCompare(b.window.date);
    if (day) return day;
    return b.score - a.score;
  });

  const byDate = new Map<string, BaitPlanSuggestion[]>();
  for (const s of ranked) {
    const list = byDate.get(s.window.date) ?? [];
    list.push(s);
    byDate.set(s.window.date, list);
  }
  return [...byDate.entries()].flatMap(([, list]) => list.slice(0, 4));
}

async function windowsForLocated(args: {
  key: string;
  latitude: number;
  longitude: number;
  times: TimeOfDay[];
  start: Date;
  days: number;
  echo?: {
    timeOfDay: TimeOfDay;
    temperatureF: number | null;
    weatherCondition: ForecastWindow["weatherCondition"];
    windSpeedMph: number | null;
    windDirection: string | null;
    precipitationIn: number | null;
    humidity: number | null;
    moonPhase: string | null;
    moonIllumination: number | null;
    pressureInHg: number | null;
    pressureMb: number | null;
    pressureTrend: string | null;
  };
  usesTide: boolean;
}): Promise<{
  windows: ForecastWindow[];
  weatherSource: PlanResult["weatherSource"];
  tideSource: PlanResult["tideSource"];
  note: string;
}> {
  const forecast = await getForecastWindows(
    args.latitude,
    args.longitude,
    args.start,
    args.days,
    args.times,
  );
  const weatherSource: PlanResult["weatherSource"] = forecast.source === "demo" ? "demo" : "openweather";
  let tideSource: PlanResult["tideSource"] = hasWorldTidesKey() ? "worldtides" : "demo";
  let windows = forecast.windows;

  if (forecast.source === "demo" && args.echo) {
    const echoDay = new Date(args.start);
    echoDay.setUTCDate(echoDay.getUTCDate() + (hashSpot(args.key) % Math.max(args.days, 1)));
    const echoed = echoPastWindow(args.latitude, args.longitude, echoDay, args.echo);
    windows = [
      ...windows.filter((w) => !(w.date === echoed.date && w.timeOfDay === echoed.timeOfDay)),
      echoed,
    ];
  }

  if (args.usesTide) {
    const tides = await getTideSeries(args.latitude, args.longitude, args.start, args.days);
    if (tides.source === "demo") tideSource = "demo";
    windows = windows.map((w) => {
      const t = tides.at(new Date(w.at));
      return {
        ...w,
        tide: t.tide,
        tideHeightFt: t.heightFt,
        tideSource: tides.source,
      };
    });
  }

  return { windows, weatherSource, tideSource, note: forecast.note };
}

/** Local calendar day from a YYYY-MM-DD query value. */
export function parsePlanDate(raw: string | null | undefined): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function buildPlan(
  records: CatchRecord[],
  days: number,
  baitRecords: BaitSpot[] = [],
  startDate?: Date,
): Promise<PlanResult> {
  const productive = records.filter(isPositiveCatch);
  const spots = groupSpots(productive).filter(
    (s) => s.latitude != null && s.longitude != null,
  );
  const baitGroups = groupBaitSpots(baitRecords).filter(
    (s) => s.latitude != null && s.longitude != null,
  );
  const start = startDate ? new Date(startDate) : new Date();
  start.setHours(0, 0, 0, 0);

  const windowsBySpotKey: Record<string, ForecastWindow[]> = {};
  const baitWindowsBySpotKey: Record<string, ForecastWindow[]> = {};
  let weatherSource: PlanResult["weatherSource"] = hasOpenWeatherKey()
    ? "openweather"
    : "demo";
  let tideSource: PlanResult["tideSource"] = hasWorldTidesKey() ? "worldtides" : "demo";
  const notes: string[] = [];

  for (const spot of spots) {
    const lat = spot.latitude!;
    const lon = spot.longitude!;
    const times = [...new Set(spot.catches.map((c) => c.timeOfDay))] as TimeOfDay[];
    const echoCatch = [...spot.catches].sort((a, b) => b.caughtAt.localeCompare(a.caughtAt))[0];
    const result = await windowsForLocated({
      key: spot.key,
      latitude: lat,
      longitude: lon,
      times,
      start,
      days,
      echo: echoCatch
        ? {
            timeOfDay: echoCatch.timeOfDay,
            temperatureF: echoCatch.temperatureF,
            weatherCondition: echoCatch.weatherCondition,
            windSpeedMph: echoCatch.windSpeedMph,
            windDirection: echoCatch.windDirection,
            precipitationIn: echoCatch.precipitationIn,
            humidity: echoCatch.humidity,
            moonPhase: echoCatch.moonPhase,
            moonIllumination: echoCatch.moonIllumination,
            pressureInHg: echoCatch.pressureInHg,
            pressureMb: echoCatch.pressureMb,
            pressureTrend: echoCatch.pressureTrend,
          }
        : undefined,
      usesTide: spot.catches.some((c) => Boolean(c.tide)),
    });
    if (result.weatherSource === "demo") weatherSource = "demo";
    if (result.tideSource === "demo" && spot.catches.some((c) => Boolean(c.tide))) {
      tideSource = "demo";
    }
    notes.push(result.note);
    windowsBySpotKey[spot.key] = result.windows;
  }

  for (const spot of baitGroups) {
    const lat = spot.latitude!;
    const lon = spot.longitude!;
    const times = [...new Set(spot.spots.map((c) => c.timeOfDay))] as TimeOfDay[];
    const echoSpot = [...spot.spots].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))[0];
    const result = await windowsForLocated({
      key: spot.key,
      latitude: lat,
      longitude: lon,
      times,
      start,
      days,
      echo: echoSpot
        ? {
            timeOfDay: echoSpot.timeOfDay,
            temperatureF: echoSpot.temperatureF,
            weatherCondition: echoSpot.weatherCondition,
            windSpeedMph: echoSpot.windSpeedMph,
            windDirection: echoSpot.windDirection,
            precipitationIn: echoSpot.precipitationIn,
            humidity: echoSpot.humidity,
            moonPhase: echoSpot.moonPhase,
            moonIllumination: echoSpot.moonIllumination,
            pressureInHg: echoSpot.pressureInHg,
            pressureMb: echoSpot.pressureMb,
            pressureTrend: echoSpot.pressureTrend,
          }
        : undefined,
      usesTide: spot.spots.some((c) => Boolean(c.tide)),
    });
    if (result.weatherSource === "demo") weatherSource = "demo";
    notes.push(result.note);
    baitWindowsBySpotKey[spot.key] = result.windows;
  }

  const suggestions = suggestFromWindows({ spots, windowsBySpotKey });
  const baitSuggestions = suggestBaitFromWindows({
    groups: baitGroups,
    windowsBySpotKey: baitWindowsBySpotKey,
  });
  const uniqueNote = [...new Set(notes)].join(" ");

  return {
    days,
    generatedAt: new Date().toISOString(),
    weatherSource,
    tideSource,
    note:
      uniqueNote ||
      "Suggestions compare upcoming windows to days you actually caught fish.",
    suggestions,
    baitSuggestions,
  };
}

/** Standing demo/source labels stay off Plan. Surface only a real lookup failure. */
export function planLookupFailureNote(note: string | null | undefined): string | null {
  if (!note || !/failed/i.test(note)) return null;
  return "Weather or tide lookup failed for this day. Matches still use your log.";
}

function hashSpot(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

export { spotKey };
