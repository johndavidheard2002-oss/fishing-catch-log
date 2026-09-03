import path from "node:path";
import { NextRequest } from "next/server";
import { listBaitSpots } from "@/lib/db/bait";
import { listCatches } from "@/lib/db/catches";
import { readUploadedPhoto } from "@/lib/storage";
import { viewerIdFromRequest } from "@/lib/viewer";

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
  const viewerId = await viewerIdFromRequest(request);
  const { filename } = await ctx.params;
  const safe = path.basename(filename);
  const catches = await listCatches({ viewerId, includeShared: true });
  const bait = await listBaitSpots({ viewerId, includeShared: true });
  const allowed = [...catches, ...bait].some((record) => {
    const stored = record.photoPath ?? "";
    return stored === safe || stored.endsWith(`/${safe}`) || stored === filename;
  });
  if (!allowed) {
    return new Response("Not found", { status: 404 });
  }
  const buf = readUploadedPhoto(safe);
  if (!buf) {
    return new Response("Not found", { status: 404 });
  }
  const ext = path.extname(safe).toLowerCase();
  const download = request.nextUrl.searchParams.get("download");
  const downloadName = sanitizeDownloadName(download, safe);
  return new Response(new Uint8Array(buf), {
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
