import type { WeatherSnapshot } from "../types";
import { seasonFromDate } from "../time";

function hash(lat: number, lon: number, day: string): number {
  const s = `${lat.toFixed(2)},${lon.toFixed(2)},${day}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic, season-aware weather so demo filters still feel real. */
export function demoWeather(lat: number, lon: number, at: Date): WeatherSnapshot {
  const season = seasonFromDate(at);
  const h = hash(lat, lon, at.toISOString().slice(0, 10));
  const roll = h % 100;

  const baseTemp: Record<string, number> = {
    spring: 58,
    summer: 79,
    fall: 61,
    winter: 38,
  };
  const latitudeAdjust = Math.max(-18, Math.min(18, (40 - lat) * 0.8));
  const jitter = (h % 13) - 6;
  const temperatureF = Math.round(baseTemp[season] + latitudeAdjust + jitter);

  let weatherCondition: WeatherSnapshot["weatherCondition"] = "clear";
  if (roll < 8) weatherCondition = "storm";
  else if (roll < 18) weatherCondition = "rain";
  else if (roll < 28) weatherCondition = "drizzle";
  else if (roll < 36) weatherCondition = "fog";
  else if (roll < 50) weatherCondition = "overcast";
  else if (roll < 68) weatherCondition = "cloudy";
  else if (roll < 84) weatherCondition = "partly-cloudy";
  else weatherCondition = "clear";

  const windSpeedMph = Math.round(4 + (h % 14));
  const precipitationIn =
    weatherCondition === "rain" || weatherCondition === "storm"
      ? Number((0.1 + (h % 6) / 20).toFixed(2))
      : weatherCondition === "drizzle"
        ? 0.05
        : 0;
  const humidity = Math.min(95, 45 + (h % 40) + (precipitationIn > 0 ? 10 : 0));

  return {
    temperatureF,
    weatherCondition,
    windSpeedMph,
    precipitationIn,
    humidity,
    source: "demo",
    note: "Demo weather (no OpenWeather key). Edit if it looks off.",
  };
}
