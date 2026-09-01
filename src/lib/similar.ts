import { adjacentTimes } from "./time";
import type {
  CatchRecord,
  SimilarMatch,
  TimeOfDay,
  WeatherCondition,
} from "./types";

const CONDITION_FAMILIES: Record<string, WeatherCondition[]> = {
  bright: ["clear", "partly-cloudy"],
  gray: ["cloudy", "overcast", "fog"],
  wet: ["drizzle", "rain", "storm", "snow"],
};

function familyOf(condition: WeatherCondition | null): string | null {
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

export function scoreSimilarity(
  target: CatchRecord,
  other: CatchRecord,
): SimilarMatch {
  let score = 0;
  const reasons: string[] = [];

  if (
    target.species &&
    other.species &&
    normalizeSpecies(target.species) === normalizeSpecies(other.species)
  ) {
    score += 25;
    reasons.push("Same species");
  }

  if (target.placeName && other.placeName) {
    const a = normalizePlace(target.placeName);
    const b = normalizePlace(other.placeName);
    if (a === b) {
      score += 20;
      reasons.push("Same spot");
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
        reasons.push("Same spot");
      }
    } else if (km <= 8) {
      score += 10;
      reasons.push(miles(km));
    } else if (km <= 40) {
      score += 4;
      reasons.push(miles(km));
    }
  }

  if (target.season && other.season && target.season === other.season) {
    score += 15;
    reasons.push(capitalize(target.season));
  }

  if (target.timeOfDay && other.timeOfDay) {
    if (target.timeOfDay === other.timeOfDay) {
      score += 12;
      reasons.push(capitalize(target.timeOfDay));
    } else if (adjacentTimes(target.timeOfDay as TimeOfDay).includes(other.timeOfDay)) {
      score += 5;
      reasons.push(`Near ${target.timeOfDay}`);
    }
  }

  if (target.weatherCondition && other.weatherCondition) {
    if (target.weatherCondition === other.weatherCondition) {
      score += 12;
      reasons.push(conditionLabel(target.weatherCondition));
    } else if (familyOf(target.weatherCondition) === familyOf(other.weatherCondition)) {
      score += 7;
      reasons.push("Similar sky");
    }
  }

  if (target.temperatureF != null && other.temperatureF != null) {
    const delta = Math.abs(target.temperatureF - other.temperatureF);
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

  if (target.windSpeedMph != null && other.windSpeedMph != null) {
    const delta = Math.abs(target.windSpeedMph - other.windSpeedMph);
    if (delta <= 3) {
      score += 6;
      reasons.push("Similar wind");
    } else if (delta <= 8) {
      score += 3;
    }
  }

  const targetWet = isWet(target.weatherCondition, target.precipitationIn);
  const otherWet = isWet(other.weatherCondition, other.precipitationIn);
  if (targetWet && otherWet) {
    score += 4;
    if (!reasons.some((r) => r.toLowerCase().includes("rain") || r === "Drizzle")) {
      reasons.push("Wet weather");
    }
  }

  return { catch: other, score, reasons };
}

function isWet(
  condition: WeatherCondition | null,
  precip: number | null,
): boolean {
  if (precip != null && precip > 0) return true;
  return condition === "drizzle" || condition === "rain" || condition === "storm" || condition === "snow";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
