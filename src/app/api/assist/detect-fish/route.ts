import { NextRequest } from "next/server";
import { detectFish, FISH_DETECT_MIN } from "@/lib/vision";
import { requireViewerId, signInRequired } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!(await requireViewerId(request))) return signInRequired();
  const form = await request.formData();
  const file = form.get("photo");
  if (!(file instanceof File)) {
    return Response.json({ error: "photo file required" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/jpeg";
  const fileName =
    (typeof form.get("fileName") === "string" ? String(form.get("fileName")) : "") || file.name;
  const detection = await detectFish(buffer, mimeType, fileName);
  const candidate = detection.isFish && detection.confidence >= FISH_DETECT_MIN;
  return Response.json({ detection, candidate });
}
