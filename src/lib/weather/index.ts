import type { WeatherSnapshot } from "../types";
import { demoWeather } from "./demo";
import { fetchArchiveWeather } from "./historical";
import { fetchOpenWeather, hasOpenWeatherKey } from "./openweather";

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
      return await fetchOpenWeather(lat, lon);
    } catch {
      const fallback = demoWeather(lat, lon, at);
      return {
        ...fallback,
        note: "OpenWeather failed — using demo weather. Everything is editable.",
      };
    }
  }

  if (inPast) {
    try {
      const archived = await fetchArchiveWeather(lat, lon, at);
      if (archived) return archived;
    } catch {
      /* fall through */
    }
  }

  if (hasOpenWeatherKey() && !recent) {
    const fallback = demoWeather(lat, lon, at);
    return {
      ...fallback,
      note: "Could not load archive weather for that date. Demo weather filled in — edit if you remember it.",
    };
  }

  return demoWeather(lat, lon, at);
}

export { hasOpenWeatherKey };
