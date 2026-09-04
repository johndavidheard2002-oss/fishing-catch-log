import { NextRequest } from "next/server";
import { isHabitat, isSaltwaterHabitat } from "@/lib/habitat";
import { requireUnlockedViewer } from "@/lib/journal-access";
import { identifySpecies } from "@/lib/vision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const access = await requireUnlockedViewer(request);
  if (!access.ok) return access.response;
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
  const fileName =
    (typeof form.get("fileName") === "string" ? String(form.get("fileName")) : "") || file.name;
  const suggestion = await identifySpecies(buffer, mimeType, {
    habitat: isHabitat(habitatRaw) && isSaltwaterHabitat(habitatRaw) ? habitatRaw : null,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lon) ? lon : null,
    placeName: String(form.get("placeName") ?? "") || null,
    fileName,
  });
  return Response.json({ suggestion });
}
