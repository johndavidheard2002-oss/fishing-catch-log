import { NextRequest } from "next/server";
import { isHabitat } from "@/lib/habitat";
import { identifySpecies } from "@/lib/vision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("photo");
  if (!(file instanceof File)) {
    return Response.json({ error: "photo file required" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/jpeg";
  const habitatRaw = String(form.get("habitat") ?? "");
  const latRaw = form.get("latitude");
  const lonRaw = form.get("longitude");
  const lat = latRaw != null && String(latRaw) !== "" ? Number(latRaw) : null;
  const lon = lonRaw != null && String(lonRaw) !== "" ? Number(lonRaw) : null;
  const suggestion = await identifySpecies(buffer, mimeType, {
    habitat: isHabitat(habitatRaw) ? habitatRaw : null,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lon) ? lon : null,
    placeName: String(form.get("placeName") ?? "") || null,
  });
  return Response.json({ suggestion });
}
