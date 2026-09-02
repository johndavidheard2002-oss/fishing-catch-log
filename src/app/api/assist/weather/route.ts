import { NextRequest } from "next/server";
import { getTideSnapshot } from "@/lib/tides";
import { getWeather } from "@/lib/weather";
import type { Habitat } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    latitude?: number;
    longitude?: number;
    at?: string;
    habitat?: Habitat | string | null;
  };
  if (body.latitude == null || body.longitude == null) {
    return Response.json(
      { error: "latitude and longitude are required" },
      { status: 400 },
    );
  }
  const at = body.at ? new Date(body.at) : new Date();
  const [weather, tide] = await Promise.all([
    getWeather(body.latitude, body.longitude, at),
    getTideSnapshot({
      latitude: body.latitude,
      longitude: body.longitude,
      at,
      habitat: body.habitat,
    }),
  ]);
  return Response.json({ weather, tide });
}
