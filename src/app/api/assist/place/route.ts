import { NextRequest } from "next/server";
import { reverseGeocode, searchPlace } from "@/lib/geocode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const results = await searchPlace(q);
  return Response.json({ results });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    latitude?: number;
    longitude?: number;
  };
  if (body.latitude == null || body.longitude == null) {
    return Response.json(
      { error: "latitude and longitude are required" },
      { status: 400 },
    );
  }
  const place = await reverseGeocode(body.latitude, body.longitude);
  return Response.json({ place });
}
