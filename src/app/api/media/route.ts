import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { uploadsDir } from "@/lib/db";

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
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "jpg";
  const id = crypto.randomUUID();
  const filename = `${id}.${ext}`;
  const dest = path.join(uploadsDir(), filename);
  fs.mkdirSync(uploadsDir(), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await file.arrayBuffer()));
  return Response.json({ photoPath: filename });
}
