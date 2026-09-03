import { adjacentTimes, formatTimeOnly } from "./time";
import type {
  CatchRecord,
  MatchStrength,
  Season,
  SimilarMatch,
  TimeOfDay,
  WeatherCondition,
} from "./types";
import { pressureTrendLabel } from "./pressure";
import { speciesListsOverlap } from "./species";
import { windDirectionDistance } from "./wind";

const CONDITION_FAMILIES: Record<string, WeatherCondition[]> = {
  bright: ["clear", "partly-cloudy"],
  gray: ["cloudy", "overcast", "fog"],
  wet: ["drizzle", "rain", "storm", "snow"],
};

const TIDE_ORDER = ["low", "incoming", "high", "outgoing", "slack"];

function familyOf(condition: WeatherCondition | null | undefined): string | null {
  if (!condition) return null;
  for (const [name, members] of Object.entries(CONDITION_FAMILIES)) {
    if (members.includes(condition)) return name;
  }
  return null;
}

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function normalizeSpecies(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePlace(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function miles(km: number): string {
  const mi = km * 0.621371;
  if (mi < 0.1) return "same spot";
  if (mi < 10) return `${mi.toFixed(1)} mi away`;
  return `${Math.round(mi)} mi away`;
}

export type MatchCloseness = "exact" | "near" | "none" | "unknown";
export type HeightCloseness = "similar" | "near" | "none" | "unknown";
export type ClockCloseness = "close" | "near" | "none" | "unknown";

export type ConditionSlice = {
  timeOfDay?: TimeOfDay | null;
  season?: Season | null;
  weatherCondition?: WeatherCondition | null;
  temperatureF?: number | null;
  windSpeedMph?: number | null;
  windDirection?: string | null;
  precipitationIn?: number | null;
  tide?: string | null;
  tideHeightFt?: number | null;
  clockAt?: string | null;
  moonPhase?: string | null;
  pressureInHg?: number | null;
  pressureTrend?: string | null;
};

export type ConditionOverlap = {
  score: number;
  reasons: string[];
  tideStage: MatchCloseness;
  tideHeight: HeightCloseness;
  timeOfDay: MatchCloseness;
  clock: ClockCloseness;
};

export const VERY_STRONG_MATCH_LABEL = "Very strong matches with matching tides";
export const VERY_STRONG_MATCH_CHIP = "Very strong · matching tides";

function clockTimeFromIso(atIso?: string | null): string {
  if (!atIso) return "";
  const date = new Date(atIso);
  if (Number.isNaN(date.getTime())) return "";
  return formatTimeOnly(atIso);
}

/** Very strong line with the forecast slot clock when we have one. */
export function veryStrongMatchLabel(atIso?: string | null): string {
  const clock = clockTimeFromIso(atIso);
  if (!clock) return VERY_STRONG_MATCH_LABEL;
  return `Very strong · conditions match around ${clock}`;
}

export function veryStrongMatchChip(atIso?: string | null): string {
  const clock = clockTimeFromIso(atIso);
  if (!clock) return VERY_STRONG_MATCH_CHIP;
  return `Very strong · ${clock}`;
}

const CLOCK_CLOSE_MINUTES = 45;
const CLOCK_NEAR_MINUTES = 120;
const TIDE_HEIGHT_SIMILAR_FT = 0.4;
const TIDE_HEIGHT_NEAR_FT = 0.8;

export function hasMatchingTidesAndTime(overlap: {
  tideStage: MatchCloseness;
  tideHeight: HeightCloseness;
  timeOfDay: MatchCloseness;
  clock: ClockCloseness;
}): boolean {
  const tideOk = overlap.tideStage === "exact" || overlap.tideStage === "near";
  const heightOk = overlap.tideHeight !== "none";
  const timeOk =
    overlap.timeOfDay === "exact" ||
    overlap.timeOfDay === "near" ||
    overlap.clock === "close";
  return tideOk && heightOk && timeOk;
}

export function suggestionStrength(
  score: number,
  overlap?: {
    tideStage: MatchCloseness;
    tideHeight: HeightCloseness;
    timeOfDay: MatchCloseness;
    clock: ClockCloseness;
  },
): MatchStrength {
  if (overlap && hasMatchingTidesAndTime(overlap)) return "very-strong";
  if (score >= 48) return "strong";
  if (score >= 34) return "good";
  return "lean";
}

/** Weather / time / tide overlap — used for similar catches and Plan. */
export function scoreConditionOverlap(
  a: ConditionSlice,
  b: ConditionSlice,
): ConditionOverlap {
  let score = 0;
  const reasons: string[] = [];

  const time = scoreTimeOfDay(a.timeOfDay, b.timeOfDay);
  score += time.score;

  const clockRaw = scoreClock(a.clockAt, b.clockAt);
  const clockApplies = time.closeness === "exact" || time.closeness === "unknown";
  const clock = clockApplies
    ? clockRaw
    : {
        ...clockRaw,
        score: 0,
        closeness: clockRaw.closeness === "unknown" ? ("unknown" as const) : ("none" as const),
      };
  score += clock.score;

  const tide = scoreTide(a.tide, b.tide, a.tideHeightFt, b.tideHeightFt);
  score += tide.score;

  const tideTimeReason = formatTideTimeReason({
    tideStage: tide.stage,
    stageName: tide.stageName,
    heightFt: tide.height === "none" ? null : tide.heightFt,
    clockIso: b.clockAt || a.clockAt || clock.displayIso,
    timeMatched: time.closeness === "exact" || time.closeness === "near" || clock.closeness === "close",
  });
  if (tideTimeReason) {
    reasons.push(tideTimeReason);
  } else if (time.reason) {
    reasons.push(time.reason);
  } else if (clock.reason) {
    reasons.push(clock.reason);
  }

  if (a.weatherCondition && b.weatherCondition) {
    if (a.weatherCondition === b.weatherCondition) {
      score += 12;
      reasons.push(conditionLabel(a.weatherCondition));
    } else if (familyOf(a.weatherCondition) === familyOf(b.weatherCondition)) {
      score += 7;
      reasons.push("Similar sky");
    }
  }

  if (a.temperatureF != null && b.temperatureF != null) {
    const delta = Math.abs(a.temperatureF - b.temperatureF);
    if (delta <= 5) {
      score += 12;
      reasons.push(`Within ${Math.round(delta)}°F`);
    } else if (delta <= 10) {
      score += 8;
      reasons.push(`Within ${Math.round(delta)}°F`);
    } else if (delta <= 15) {
      score += 4;
      reasons.push(`${Math.round(delta)}°F apart`);
    }
  }

  if (a.windSpeedMph != null && b.windSpeedMph != null) {
    const delta = Math.abs(a.windSpeedMph - b.windSpeedMph);
    if (delta <= 3) {
      score += 6;
      reasons.push("Similar wind");
    } else if (delta <= 8) {
      score += 3;
    }
  }

  if (a.windDirection && b.windDirection) {
    const dist = windDirectionDistance(a.windDirection, b.windDirection);
    if (dist === 0) {
      score += 4;
      reasons.push(`${a.windDirection} wind`);
    } else if (dist != null && dist <= 1) {
      score += 3;
      reasons.push("Nearby wind direction");
    }
  }

  if (a.moonPhase && b.moonPhase && a.moonPhase === b.moonPhase) {
    score += 6;
    reasons.push(`${a.moonPhase} moon`);
  }

  if (a.pressureTrend && b.pressureTrend && a.pressureTrend === b.pressureTrend) {
    score += 4;
    reasons.push(`${pressureTrendLabel(a.pressureTrend as "rising" | "falling" | "steady")} pressure`);
  }

  if (a.pressureInHg != null && b.pressureInHg != null) {
    const delta = Math.abs(a.pressureInHg - b.pressureInHg);
    if (delta <= 0.1) {
      score += 3;
      if (!reasons.some((r) => r.toLowerCase().includes("pressure"))) {
        reasons.push("Similar pressure");
      }
    }
  }

  const aWet = isWet(a.weatherCondition ?? null, a.precipitationIn ?? null);
  const bWet = isWet(b.weatherCondition ?? null, b.precipitationIn ?? null);
  if (aWet && bWet) {
    score += 4;
    if (!reasons.some((r) => r.toLowerCase().includes("rain") || r === "Drizzle")) {
      reasons.push("Wet weather");
    }
  }

  return {
    score,
    reasons,
    tideStage: tide.stage,
    tideHeight: tide.height,
    timeOfDay: time.closeness,
    clock: clock.closeness,
  };
}

function scoreTimeOfDay(
  a: TimeOfDay | null | undefined,
  b: TimeOfDay | null | undefined,
): { score: number; closeness: MatchCloseness; reason: string | null } {
  if (!a || !b) return { score: 0, closeness: "unknown", reason: null };
  if (a === b) {
    return { score: 16, closeness: "exact", reason: "Same time of day" };
  }
  if (adjacentTimes(a).includes(b)) {
    return { score: 8, closeness: "near", reason: "Nearby time of day" };
  }
  return { score: 0, closeness: "none", reason: null };
}

function scoreClock(
  a: string | null | undefined,
  b: string | null | undefined,
): { score: number; closeness: ClockCloseness; reason: string | null; displayIso: string | null } {
  const delta = clockDeltaMinutes(a, b);
  const displayIso = pickClockIso(b, a);
  if (delta == null) {
    return { score: 0, closeness: "unknown", reason: null, displayIso };
  }
  if (delta <= CLOCK_CLOSE_MINUTES) {
    return {
      score: 8,
      closeness: "close",
      reason: displayIso ? `~${formatTimeOnly(displayIso)}` : null,
      displayIso,
    };
  }
  if (delta <= CLOCK_NEAR_MINUTES) {
    return { score: 4, closeness: "near", reason: null, displayIso };
  }
  return { score: 0, closeness: "none", reason: null, displayIso };
}

function scoreTide(
  a: string | null | undefined,
  b: string | null | undefined,
  aHeight: number | null | undefined,
  bHeight: number | null | undefined,
): {
  score: number;
  stage: MatchCloseness;
  height: HeightCloseness;
  stageName: string | null;
  heightFt: number | null;
} {
  const left = normalizeTide(a);
  const right = normalizeTide(b);
  const heightFt = pickHeight(bHeight, aHeight);
  const height = scoreTideHeight(aHeight, bHeight);

  if (!left || !right) {
    return { score: height.score, stage: "unknown", height: height.closeness, stageName: null, heightFt };
  }

  let stage: MatchCloseness = "none";
  let stageScore = 0;
  if (left === right) {
    stage = "exact";
    stageScore = 18;
  } else {
    const i = TIDE_ORDER.indexOf(left);
    const j = TIDE_ORDER.indexOf(right);
    if (i >= 0 && j >= 0 && Math.abs(i - j) === 1) {
      stage = "near";
      stageScore = 8;
    }
  }

  return {
    score: stageScore + (stage === "none" ? 0 : height.score),
    stage,
    height: height.closeness,
    stageName: friendlyTideStage(right || left),
    heightFt,
  };
}

function scoreTideHeight(
  a: number | null | undefined,
  b: number | null | undefined,
): { score: number; closeness: HeightCloseness } {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) {
    return { score: 0, closeness: "unknown" };
  }
  const delta = Math.abs(a - b);
  if (delta <= TIDE_HEIGHT_SIMILAR_FT) {
    return { score: 10, closeness: "similar" };
  }
  if (delta <= TIDE_HEIGHT_NEAR_FT) {
    return { score: 5, closeness: "near" };
  }
  return { score: 0, closeness: "none" };
}

function formatTideTimeReason(args: {
  tideStage: MatchCloseness;
  stageName: string | null;
  heightFt: number | null;
  clockIso: string | null | undefined;
  timeMatched: boolean;
}): string | null {
  if (args.tideStage !== "exact" && args.tideStage !== "near") return null;
  if (!args.stageName) return null;
  const same = args.tideStage === "exact" ? "same" : "nearby";
  let text = `${same} ${args.stageName} tide`;
  if (args.heightFt != null && Number.isFinite(args.heightFt)) {
    text += ` ~${args.heightFt.toFixed(1)} ft`;
  }
  if (args.timeMatched && args.clockIso) {
    text += `, ~${formatTimeOnly(args.clockIso)}`;
  }
  return text;
}

function friendlyTideStage(normalized: string): string {
  if (normalized === "incoming") return "rising";
  if (normalized === "outgoing") return "falling";
  return normalized;
}

function pickHeight(
  preferred: number | null | undefined,
  fallback: number | null | undefined,
): number | null {
  if (preferred != null && Number.isFinite(preferred)) return preferred;
  if (fallback != null && Number.isFinite(fallback)) return fallback;
  return null;
}

function pickClockIso(
  preferred: string | null | undefined,
  fallback: string | null | undefined,
): string | null {
  if (preferred && !Number.isNaN(new Date(preferred).getTime())) return preferred;
  if (fallback && !Number.isNaN(new Date(fallback).getTime())) return fallback;
  return null;
}

function clockDeltaMinutes(
  a: string | null | undefined,
  b: string | null | undefined,
): number | null {
  const left = minutesOfDay(a);
  const right = minutesOfDay(b);
  if (left == null || right == null) return null;
  const raw = Math.abs(left - right);
  return Math.min(raw, 1440 - raw);
}

function minutesOfDay(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
}

function normalizeTide(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const v = value.trim().toLowerCase();
  if (v.includes("flood") || v === "incoming" || v === "rising") return "incoming";
  if (v.includes("ebb") || v === "outgoing" || v === "falling") return "outgoing";
  if (v === "high" || v === "high tide") return "high";
  if (v === "low" || v === "low tide") return "low";
  if (v === "slack") return "slack";
  return v;
}

export function scoreSimilarity(
  target: CatchRecord,
  other: CatchRecord,
): SimilarMatch {
  const overlap = scoreConditionOverlap(
    { ...target, clockAt: target.caughtAt },
    { ...other, clockAt: other.caughtAt },
  );
  let score = overlap.score;
  const reasons = [...overlap.reasons];

  const targetList = target.speciesList?.length ? target.speciesList : [target.species];
  const otherList = other.speciesList?.length ? other.speciesList : [other.species];
  if (speciesListsOverlap(targetList, otherList)) {
    score += 25;
    reasons.unshift(
      targetList.length === 1 && otherList.length === 1 && normalizeSpecies(targetList[0]) === normalizeSpecies(otherList[0])
        ? "Same species"
        : "Shared species",
    );
  }

  if (target.placeName && other.placeName) {
    const a = normalizePlace(target.placeName);
    const b = normalizePlace(other.placeName);
    if (a === b) {
      score += 20;
      reasons.unshift("Same spot");
    } else if (a.includes(b) || b.includes(a)) {
      score += 12;
      reasons.push("Nearby named water");
    }
  }

  if (
    target.latitude != null &&
    target.longitude != null &&
    other.latitude != null &&
    other.longitude != null
  ) {
    const km = haversineKm(
      target.latitude,
      target.longitude,
      other.latitude,
      other.longitude,
    );
    if (km <= 1.5) {
      if (!reasons.includes("Same spot")) {
        score += 18;
        reasons.unshift("Same spot");
      }
    } else if (km <= 8) {
      score += 10;
      reasons.push(miles(km));
    } else if (km <= 40) {
      score += 4;
      reasons.push(miles(km));
    }
  }

  return {
    catch: other,
    score,
    reasons,
    strength: suggestionStrength(overlap.score, overlap),
  };
}

function isWet(
  condition: WeatherCondition | null,
  precip: number | null,
): boolean {
  if (precip != null && precip > 0) return true;
  return condition === "drizzle" || condition === "rain" || condition === "storm" || condition === "snow";
}

export function conditionLabel(condition: WeatherCondition): string {
  switch (condition) {
    case "partly-cloudy":
      return "Partly cloudy";
    case "clear":
      return "Clear";
    case "cloudy":
      return "Cloudy";
    case "overcast":
      return "Overcast";
    case "fog":
      return "Fog";
    case "drizzle":
      return "Drizzle";
    case "rain":
      return "Rain";
    case "snow":
      return "Snow";
    case "storm":
      return "Storm";
    default:
      return condition;
  }
}

export function findSimilar(
  target: CatchRecord,
  all: CatchRecord[],
  options?: { limit?: number; minScore?: number },
): SimilarMatch[] {
  const limit = options?.limit ?? 8;
  const minScore = options?.minScore ?? 18;
  return all
    .filter((c) => c.id !== target.id)
    .map((c) => scoreSimilarity(target, c))
    .filter((m) => m.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
