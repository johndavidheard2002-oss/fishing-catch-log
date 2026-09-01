import { conditionFromOpenWeather } from "../labels";
import {
  dateKeyLocal,
  localTimeOfDay,
  seasonFromDate,
  TIME_OF_DAY_HOURS,
} from "../time";
import type { ForecastWindow, TimeOfDay, WeatherCondition } from "../types";
import { demoWeather } from "./demo";
import { hasOpenWeatherKey } from "./openweather";

type OpenWeatherForecast = {
  list?: {
    dt: number;
    main?: { temp: number; humidity: number };
    weather?: { main: string; description: string }[];
    wind?: { speed: number };
    clouds?: { all: number };
    rain?: { "3h"?: number };
    snow?: { "3h"?: number };
  }[];
};

const TIME_ADJ: Record<TimeOfDay, number> = {
  dawn: -6,
  morning: -2,
  afternoon: 5,
  dusk: 0,
  night: -8,
};

function windowFromSnapshot(args: {
  at: Date;
  lat: number;
  lon: number;
  temperatureF: number | null;
  weatherCondition: WeatherCondition | null;
  windSpeedMph: number | null;
  precipitationIn: number | null;
  humidity: number | null;
  weatherSource: "openweather" | "demo";
}): ForecastWindow {
  return {
    at: args.at.toISOString(),
    date: dateKeyLocal(args.at, args.lon),
    timeOfDay: localTimeOfDay(args.at, args.lon),
    season: seasonFromDate(args.at),
    latitude: args.lat,
    longitude: args.lon,
    temperatureF: args.temperatureF,
    weatherCondition: args.weatherCondition,
    windSpeedMph: args.windSpeedMph,
    precipitationIn: args.precipitationIn,
    humidity: args.humidity,
    tide: null,
    tideHeightFt: null,
    weatherSource: args.weatherSource,
    tideSource: "none",
  };
}

export function demoForecastWindows(
  lat: number,
  lon: number,
  start: Date,
  days: number,
  preferredTimes?: TimeOfDay[],
): ForecastWindow[] {
  const times = preferredTimes?.length
    ? preferredTimes
    : (["dawn", "morning", "afternoon", "dusk"] as TimeOfDay[]);
  const windows: ForecastWindow[] = [];

  for (let d = 0; d < days; d++) {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + d);
    for (const tod of times) {
      const at = dateAtHour(day, TIME_OF_DAY_HOURS[tod], lon);
      const snap = demoWeather(lat, lon, at);
      const temp =
        snap.temperatureF != null ? snap.temperatureF + TIME_ADJ[tod] : null;
      let condition = snap.weatherCondition;
      if (tod === "dawn" && (snap.humidity ?? 0) > 70 && condition === "clear") {
        condition = "fog";
      }
      windows.push(
        windowFromSnapshot({
          at,
          lat,
          lon,
          temperatureF: temp,
          weatherCondition: condition,
          windSpeedMph: snap.windSpeedMph,
          precipitationIn: snap.precipitationIn,
          humidity: snap.humidity,
          weatherSource: "demo",
        }),
      );
    }
  }
  return windows;
}

/** Overlay one window that echoes a past successful condition so demo Plan is never empty. */
export function echoPastWindow(
  lat: number,
  lon: number,
  day: Date,
  echo: {
    timeOfDay: TimeOfDay;
    temperatureF: number | null;
    weatherCondition: WeatherCondition | null;
    windSpeedMph: number | null;
    precipitationIn: number | null;
    humidity: number | null;
  },
): ForecastWindow {
  const at = dateAtHour(day, TIME_OF_DAY_HOURS[echo.timeOfDay], lon);
  const jitter = ((day.getUTCDate() % 5) - 2);
  return windowFromSnapshot({
    at,
    lat,
    lon,
    temperatureF:
      echo.temperatureF != null ? echo.temperatureF + jitter : null,
    weatherCondition: echo.weatherCondition,
    windSpeedMph: echo.windSpeedMph,
    precipitationIn: echo.precipitationIn,
    humidity: echo.humidity,
    weatherSource: "demo",
  });
}

function dateAtHour(day: Date, hour: number, lon: number): Date {
  const whole = Math.floor(hour);
  const mins = Math.round((hour - whole) * 60);
  const localAsUtc = Date.UTC(
    day.getUTCFullYear(),
    day.getUTCMonth(),
    day.getUTCDate(),
    whole,
    mins,
    0,
  );
  const solarOffsetMs = (lon / 15) * 60 * 60 * 1000;
  return new Date(localAsUtc - solarOffsetMs);
}

export async function fetchOpenWeatherForecast(
  lat: number,
  lon: number,
): Promise<ForecastWindow[]> {
  const key = process.env.OPENWEATHER_API_KEY?.trim();
  if (!key) throw new Error("OPENWEATHER_API_KEY is not set");

  const url = new URL("https://api.openweathermap.org/data/2.5/forecast");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("appid", key);
  url.searchParams.set("units", "imperial");

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`OpenWeather forecast error ${res.status}`);
  const data = (await res.json()) as OpenWeatherForecast;

  const buckets = new Map<string, { window: ForecastWindow; dist: number }>();
  for (const item of data.list ?? []) {
    const at = new Date(item.dt * 1000);
    const tod = localTimeOfDay(at, lon);
    const date = dateKeyLocal(at, lon);
    const center = TIME_OF_DAY_HOURS[tod];
    const localHour =
      ((at.getTime() + (lon / 15) * 3600000) / 3600000) % 24;
    const dist = Math.abs(localHour - center);
    const w = item.weather?.[0];
    const rainIn = (item.rain?.["3h"] ?? item.snow?.["3h"] ?? 0) / 25.4;
    const window = windowFromSnapshot({
      at,
      lat,
      lon,
      temperatureF: item.main?.temp != null ? Math.round(item.main.temp) : null,
      weatherCondition: w
        ? conditionFromOpenWeather(w.main, w.description, item.clouds?.all)
        : null,
      windSpeedMph: item.wind?.speed != null ? Math.round(item.wind.speed) : null,
      precipitationIn: rainIn ? Number(rainIn.toFixed(2)) : 0,
      humidity: item.main?.humidity ?? null,
      weatherSource: "openweather",
    });
    const keyB = `${date}|${tod}`;
    const prev = buckets.get(keyB);
    if (!prev || dist < prev.dist) {
      buckets.set(keyB, { window, dist });
    }
  }

  return [...buckets.values()]
    .map((entry) => entry.window)
    .sort((a, b) => a.at.localeCompare(b.at));
}

export async function getForecastWindows(
  lat: number,
  lon: number,
  start: Date,
  days: number,
  preferredTimes?: TimeOfDay[],
): Promise<{ windows: ForecastWindow[]; source: "openweather" | "demo"; note: string }> {
  const demo = {
    windows: demoForecastWindows(lat, lon, start, days, preferredTimes),
    source: "demo" as const,
    note: "Demo forecast (no OpenWeather key). Patterned from season and your spots — not a live forecast.",
  };

  if (!hasOpenWeatherKey()) return demo;

  try {
    const live = await fetchOpenWeatherForecast(lat, lon);
    const cutoff = start.getTime() + days * 86400000;
    const clipped = live.filter((w) => {
      const t = new Date(w.at).getTime();
      return t >= start.getTime() - 3 * 3600000 && t <= cutoff;
    });
    if (!clipped.length) return demo;
    return {
      windows: clipped,
      source: "openweather",
      note: "Upcoming conditions from OpenWeather 5-day forecast.",
    };
  } catch {
    return {
      ...demo,
      note: "OpenWeather forecast failed — using demo forecast. Suggestions are still pattern matches.",
    };
  }
}
