import { NextRequest } from "next/server";
import { reverseGeocode } from "@/lib/geocode";
import { requireUnlockedViewer } from "@/lib/journal-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const access = await requireUnlockedViewer(request);
  if (!access.ok) return access.response;
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
