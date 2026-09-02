import { NextRequest } from "next/server";
import { detectFish, FISH_DETECT_MIN } from "@/lib/vision";

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
  const detection = await detectFish(buffer, mimeType, file.name);
  const candidate = detection.isFish && detection.confidence >= FISH_DETECT_MIN;
  return Response.json({ detection, candidate });
}
