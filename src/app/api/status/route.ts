import { hasWorldTidesKey } from "@/lib/tides";
import { hasOpenAiKey } from "@/lib/vision";
import { hasOpenWeatherKey } from "@/lib/weather";
import type { ProviderStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status: ProviderStatus = {
    weather: hasOpenWeatherKey() ? "openweather" : "demo",
    vision: hasOpenAiKey() ? "openai" : "demo",
    geocode: "nominatim",
    forecast: hasOpenWeatherKey() ? "openweather" : "demo",
    tides: hasWorldTidesKey() ? "worldtides" : "demo",
  };
  return Response.json(status);
}
