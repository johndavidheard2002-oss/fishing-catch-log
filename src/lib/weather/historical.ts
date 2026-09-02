import { conditionFromOpenWeather } from "../labels";
import type { WeatherCondition, WeatherSnapshot } from "../types";

const WMO_TO_OW: Record<number, { main: string; description: string }> = {
  0: { main: "Clear", description: "clear sky" },
  1: { main: "Clouds", description: "few clouds" },
  2: { main: "Clouds", description: "scattered clouds" },
  3: { main: "Clouds", description: "overcast" },
  45: { main: "Fog", description: "fog" },
  48: { main: "Fog", description: "fog" },
  51: { main: "Drizzle", description: "light drizzle" },
  53: { main: "Drizzle", description: "drizzle" },
  55: { main: "Drizzle", description: "drizzle" },
  61: { main: "Rain", description: "light rain" },
  63: { main: "Rain", description: "rain" },
  65: { main: "Rain", description: "rain" },
  71: { main: "Snow", description: "snow" },
  73: { main: "Snow", description: "snow" },
  75: { main: "Snow", description: "snow" },
  80: { main: "Rain", description: "rain" },
  81: { main: "Rain", description: "rain" },
  82: { main: "Rain", description: "rain" },
  95: { main: "Thunderstorm", description: "thunderstorm" },
  96: { main: "Thunderstorm", description: "thunderstorm" },
  99: { main: "Thunderstorm", description: "thunderstorm" },
};

function conditionFromWmo(code: number): WeatherCondition {
  const mapped = WMO_TO_OW[code] ?? { main: "Clouds", description: "clouds" };
  return conditionFromOpenWeather(mapped.main, mapped.description);
}

export async function fetchArchiveWeather(
  lat: number,
  lon: number,
  at: Date,
): Promise<WeatherSnapshot | null> {
  const day = at.toISOString().slice(0, 10);
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("start_date", day);
  url.searchParams.set("end_date", day);
  url.searchParams.set(
    "hourly",
    "temperature_2m,weathercode,windspeed_10m,precipitation,relativehumidity_2m",
  );
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("windspeed_unit", "mph");
  url.searchParams.set("precipitation_unit", "inch");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    hourly?: {
      time?: string[];
      temperature_2m?: Array<number | null>;
      weathercode?: Array<number | null>;
      windspeed_10m?: Array<number | null>;
      precipitation?: Array<number | null>;
      relativehumidity_2m?: Array<number | null>;
    };
  };
  const times = data.hourly?.time ?? [];
  if (!times.length) return null;

  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]).getTime() - at.getTime());
    if (diff < bestDiff) {
      best = i;
      bestDiff = diff;
    }
  }

  const code = data.hourly?.weathercode?.[best] ?? 2;
  return {
    temperatureF: data.hourly?.temperature_2m?.[best] ?? null,
    weatherCondition: conditionFromWmo(code ?? 2),
    windSpeedMph: data.hourly?.windspeed_10m?.[best] ?? null,
    precipitationIn: data.hourly?.precipitation?.[best] ?? null,
    humidity: data.hourly?.relativehumidity_2m?.[best] ?? null,
    source: "open-meteo",
    note: "Weather for that date from Open-Meteo archive. Edit if you remember it differently.",
  };
}
