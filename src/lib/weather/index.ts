import type { WeatherSnapshot } from "../types";
import { demoWeather } from "./demo";
import { fetchOpenWeather, hasOpenWeatherKey } from "./openweather";

export async function getWeather(
  lat: number,
  lon: number,
  at: Date = new Date(),
): Promise<WeatherSnapshot> {
  const recent = Date.now() - at.getTime() < 6 * 60 * 60 * 1000;
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

  if (hasOpenWeatherKey() && !recent) {
    const fallback = demoWeather(lat, lon, at);
    return {
      ...fallback,
      note: "OpenWeather current-conditions API only covers recent time. Demo weather filled in for this past date — edit if you remember it.",
    };
  }

  return demoWeather(lat, lon, at);
}

export { hasOpenWeatherKey };
