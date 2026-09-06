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
      return withMoon(demoWeather(lat, lon, at), at);
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
    return withMoon(demoWeather(lat, lon, at), at);
  }

  return withMoon(demoWeather(lat, lon, at), at);
}

export { hasOpenWeatherKey };
