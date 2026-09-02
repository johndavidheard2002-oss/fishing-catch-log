import { conditionFromOpenWeather } from "../labels";
import { moonForDate } from "../moon";
import { pressureFromMb } from "../pressure";
import type { WeatherSnapshot } from "../types";
import { degreesToWindDirection } from "../wind";

type OpenWeatherResponse = {
  weather?: { main: string; description: string }[];
  main?: { temp: number; humidity: number; pressure?: number };
  wind?: { speed: number; deg?: number };
  clouds?: { all: number };
  rain?: { "1h"?: number; "3h"?: number };
  snow?: { "1h"?: number; "3h"?: number };
};

export function hasOpenWeatherKey(): boolean {
  return Boolean(process.env.OPENWEATHER_API_KEY?.trim());
}

export async function fetchOpenWeather(
  lat: number,
  lon: number,
  at: Date = new Date(),
): Promise<WeatherSnapshot> {
  const key = process.env.OPENWEATHER_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENWEATHER_API_KEY is not set");
  }

  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("appid", key);
  url.searchParams.set("units", "imperial");

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`OpenWeather error ${res.status}`);
  }
  const data = (await res.json()) as OpenWeatherResponse;
  const w = data.weather?.[0];
  const rainIn =
    (data.rain?.["1h"] ?? data.rain?.["3h"] ?? data.snow?.["1h"] ?? 0) / 25.4;
  const pressure = pressureFromMb(data.main?.pressure);
  const moon = moonForDate(at);

  return {
    temperatureF: data.main?.temp != null ? Math.round(data.main.temp) : null,
    weatherCondition: w
      ? conditionFromOpenWeather(w.main, w.description, data.clouds?.all)
      : null,
    windSpeedMph: data.wind?.speed != null ? Math.round(data.wind.speed) : null,
    windDirection:
      data.wind?.deg != null ? degreesToWindDirection(data.wind.deg) : null,
    precipitationIn: rainIn ? Number(rainIn.toFixed(2)) : 0,
    humidity: data.main?.humidity ?? null,
    moonPhase: moon.phase,
    moonIllumination: moon.illumination,
    pressureInHg: pressure.pressureInHg,
    pressureMb: pressure.pressureMb,
    pressureTrend: null,
    source: "openweather",
    note: "Live weather from OpenWeather. Moon phase is from the date.",
  };
}
