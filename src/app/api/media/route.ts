import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("photo");
  if (!(file instanceof File)) {
    return Response.json({ error: "photo file required" }, { status: 400 });
  }
  const mime = file.type || "image/jpeg";
  if (!ALLOWED.has(mime)) {
    return Response.json(
      { error: "Use a JPEG, PNG, WebP, or GIF photo." },
      { status: 400 },
    );
  }
  const { saveUploadedPhoto } = await import("@/lib/storage");
  const result = await saveUploadedPhoto(file);
  return Response.json(result);
}
