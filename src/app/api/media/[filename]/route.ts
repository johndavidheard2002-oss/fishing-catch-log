import path from "node:path";
import { NextRequest } from "next/server";
import { loadUploadedMedia } from "@/lib/storage";
import { requireViewerId, signInRequired } from "@/lib/viewer";

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
  request: NextRequest,
  ctx: { params: Promise<{ filename: string }> },
) {
  if (!(await requireViewerId(request))) return signInRequired();
  const { filename } = await ctx.params;
  const media = loadUploadedMedia(filename);
  if (!media) {
    return new Response("Not found", { status: 404 });
  }
  const ext = path.extname(media.filename).toLowerCase();
  const download = request.nextUrl.searchParams.get("download");
  const downloadName = sanitizeDownloadName(download, media.filename);
  return new Response(new Uint8Array(media.body), {
    headers: {
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=31536000, immutable",
      ...(download
        ? { "Content-Disposition": `attachment; filename="${downloadName}"` }
        : {}),
    },
  });
}

function sanitizeDownloadName(requested: string | null, fallback: string): string {
  const raw = (requested && requested !== "1" ? requested : fallback).trim();
  const base = path.basename(raw).replace(/["\\\r\n]/g, "");
  return base || fallback;
}
