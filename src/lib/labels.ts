import type { WeatherCondition } from "./types";

const LABEL_TO_CONDITION: Record<string, WeatherCondition> = {
  clear: "clear",
  sunny: "clear",
  fair: "clear",
  "partly-cloudy": "partly-cloudy",
  "partly cloudy": "partly-cloudy",
  "few clouds": "partly-cloudy",
  cloudy: "cloudy",
  clouds: "cloudy",
  "scattered clouds": "cloudy",
  "broken clouds": "cloudy",
  overcast: "overcast",
  fog: "fog",
  mist: "fog",
  haze: "fog",
  drizzle: "drizzle",
  "light rain": "drizzle",
  rain: "rain",
  showers: "rain",
  snow: "snow",
  sleet: "snow",
  storm: "storm",
  thunderstorm: "storm",
  thunder: "storm",
};

export function normalizeCondition(raw: string | null | undefined): WeatherCondition | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return LABEL_TO_CONDITION[key] ?? (isCondition(key) ? key : null);
}

function isCondition(value: string): value is WeatherCondition {
  return [
    "clear",
    "partly-cloudy",
    "cloudy",
    "overcast",
    "fog",
    "drizzle",
    "rain",
    "snow",
    "storm",
  ].includes(value);
}

export function conditionFromOpenWeather(
  main: string,
  description: string,
  cloudCover?: number,
): WeatherCondition {
  const m = main.toLowerCase();
  const d = description.toLowerCase();
  if (m.includes("thunder")) return "storm";
  if (m.includes("snow") || d.includes("sleet")) return "snow";
  if (m.includes("drizzle")) return "drizzle";
  if (m.includes("rain")) return d.includes("light") ? "drizzle" : "rain";
  if (m.includes("fog") || m.includes("mist") || m.includes("haze")) return "fog";
  if (m.includes("clear")) return "clear";
  if (m.includes("cloud")) {
    if (cloudCover != null) {
      if (cloudCover < 30) return "partly-cloudy";
      if (cloudCover < 70) return "cloudy";
      return "overcast";
    }
    if (d.includes("few") || d.includes("scattered")) return "partly-cloudy";
    if (d.includes("overcast")) return "overcast";
    return "cloudy";
  }
  return "cloudy";
}

export const CONDITION_LABELS: Record<WeatherCondition, string> = {
  clear: "Clear",
  "partly-cloudy": "Partly cloudy",
  cloudy: "Cloudy",
  overcast: "Overcast",
  fog: "Fog",
  drizzle: "Drizzle",
  rain: "Rain",
  snow: "Snow",
  storm: "Storm",
};

export { COMMON_SPECIES } from "./habitat";
