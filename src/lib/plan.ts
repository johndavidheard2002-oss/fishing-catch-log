import { groupBaitSpots, baitTypesLabel } from "./bait";
import { groupSpots, spotKey } from "./filters";
import { speciesLabel } from "./species";
import { formatDateOnly } from "./time";
import { conditionLabel, scoreConditionOverlap, suggestionStrength } from "./similar";
import { getTideSeries, hasWorldTidesKey } from "./tides";
import type {
  BaitPlanSuggestion,
  BaitSpot,
  BaitSpotGroup,
  CatchRecord,
  ForecastWindow,
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

export async function buildPlan(
  records: CatchRecord[],
  days: number,
  baitRecords: BaitSpot[] = [],
): Promise<PlanResult> {
  const productive = records.filter(isPositiveCatch);
  const spots = groupSpots(productive).filter(
    (s) => s.latitude != null && s.longitude != null,
  );
  const baitGroups = groupBaitSpots(baitRecords).filter(
    (s) => s.latitude != null && s.longitude != null,
  );
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

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

function hashSpot(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

export { spotKey };
