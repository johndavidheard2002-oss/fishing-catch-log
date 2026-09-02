import type { WeatherSnapshot } from "../types";
import { demoWeather } from "./demo";
import { fetchArchiveWeather } from "./historical";
import { fetchOpenWeather, hasOpenWeatherKey } from "./openweather";
import { moonForDate } from "../moon";

export function withMoon(snap: WeatherSnapshot, at: Date): WeatherSnapshot {
  const moon = moonForDate(at);
  return {
    ...snap,
    moonPhase: moon.phase,
    moonIllumination: moon.illumination,
  };
}

export async function getWeather(
  lat: number,
  lon: number,
  at: Date = new Date(),
): Promise<WeatherSnapshot> {
  const ageMs = Date.now() - at.getTime();
  const recent = ageMs >= 0 && ageMs < 6 * 60 * 60 * 1000;
  const inPast = ageMs > 6 * 60 * 60 * 1000;

  if (hasOpenWeatherKey() && recent) {
    try {
      return withMoon(await fetchOpenWeather(lat, lon, at), at);
    } catch {
      const fallback = demoWeather(lat, lon, at);
      return {
        ...withMoon(fallback, at),
        note: "OpenWeather failed — using demo weather. Everything is editable.",
      };
    }
  }

  if (inPast) {
    try {
      const archived = await fetchArchiveWeather(lat, lon, at);
      if (archived) return withMoon(archived, at);
    } catch {
      /* fall through */
    }
  }

  if (hasOpenWeatherKey() && !recent) {
    const fallback = demoWeather(lat, lon, at);
    return {
      ...withMoon(fallback, at),
      note: "Could not load archive weather for that date. Demo weather filled in — edit if you remember it.",
    };
  }

  return withMoon(demoWeather(lat, lon, at), at);
}

export { hasOpenWeatherKey };
