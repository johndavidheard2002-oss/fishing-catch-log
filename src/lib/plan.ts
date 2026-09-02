import { groupSpots, spotKey } from "./filters";
import { speciesLabel } from "./species";
import { formatDateOnly } from "./time";
import { conditionLabel, scoreConditionOverlap } from "./similar";
import { getTideSeries, hasWorldTidesKey } from "./tides";
import type {
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

export function suggestionStrength(score: number): PlanSuggestion["strength"] {
  if (score >= 48) return "strong";
  if (score >= 34) return "good";
  return "lean";
}

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
  const overlap = scoreConditionOverlap(window, record);
  return { catch: record, score: overlap.score, reasons: overlap.reasons };
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
        strength: suggestionStrength(best.score),
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

export async function buildPlan(
  records: CatchRecord[],
  days: number,
): Promise<PlanResult> {
  const productive = records.filter(isPositiveCatch);
  const spots = groupSpots(productive).filter(
    (s) => s.latitude != null && s.longitude != null,
  );
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const windowsBySpotKey: Record<string, ForecastWindow[]> = {};
  let weatherSource: PlanResult["weatherSource"] = hasOpenWeatherKey()
    ? "openweather"
    : "demo";
  let tideSource: PlanResult["tideSource"] = hasWorldTidesKey() ? "worldtides" : "demo";
  const notes: string[] = [];

  for (const spot of spots) {
    const lat = spot.latitude!;
    const lon = spot.longitude!;
    const times = [...new Set(spot.catches.map((c) => c.timeOfDay))] as TimeOfDay[];
    const forecast = await getForecastWindows(lat, lon, start, days, times);
    if (forecast.source === "demo") weatherSource = "demo";
    notes.push(forecast.note);

    let windows = forecast.windows;

    if (forecast.source === "demo" && spot.catches[0]) {
      const echoCatch = [...spot.catches].sort(
        (a, b) => b.caughtAt.localeCompare(a.caughtAt),
      )[0];
      const echoDay = new Date(start);
      echoDay.setUTCDate(echoDay.getUTCDate() + (hashSpot(spot.key) % Math.max(days, 1)));
      const echoed = echoPastWindow(lat, lon, echoDay, {
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
      });
      windows = [
        ...windows.filter(
          (w) => !(w.date === echoed.date && w.timeOfDay === echoed.timeOfDay),
        ),
        echoed,
      ];
    }

    const usesTide = spot.catches.some((c) => Boolean(c.tide));
    if (usesTide) {
      const tides = await getTideSeries(lat, lon, start, days);
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

    windowsBySpotKey[spot.key] = windows;
  }

  const suggestions = suggestFromWindows({ spots, windowsBySpotKey });
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
  };
}

function hashSpot(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

export { spotKey };
