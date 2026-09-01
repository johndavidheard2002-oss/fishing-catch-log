import { NextRequest } from "next/server";
import { getWeather } from "@/lib/weather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    latitude?: number;
    longitude?: number;
    at?: string;
  };
  if (body.latitude == null || body.longitude == null) {
    return Response.json(
      { error: "latitude and longitude are required" },
      { status: 400 },
    );
  }
  const at = body.at ? new Date(body.at) : new Date();
  const weather = await getWeather(body.latitude, body.longitude, at);
  return Response.json({ weather });
}
