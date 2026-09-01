import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { uploadsDir } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ filename: string }> },
) {
  const { filename } = await ctx.params;
  const safe = path.basename(filename);
  const filePath = path.join(uploadsDir(), safe);
  if (!fs.existsSync(filePath)) {
    return new Response("Not found", { status: 404 });
  }
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(safe).toLowerCase();
  return new Response(buf, {
    headers: {
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
