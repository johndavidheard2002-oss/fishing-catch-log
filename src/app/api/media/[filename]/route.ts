import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { listCatches } from "@/lib/db/catches";
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
  const viewerId = viewerIdFromRequest(request);
  const { filename } = await ctx.params;
  const safe = path.basename(filename);
  const allowed = listCatches({ viewerId, includeShared: true }).some((record) => {
    const stored = record.photoPath ?? "";
    return stored === safe || stored.endsWith(`/${safe}`) || stored === filename;
  });
  if (!allowed) {
    return new Response("Not found", { status: 404 });
  }
  const filePath = path.join(process.cwd(), "data", "uploads", safe);
  if (!fs.existsSync(filePath)) {
    return new Response("Not found", { status: 404 });
  }
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(safe).toLowerCase();
  const download = request.nextUrl.searchParams.get("download");
  const downloadName = sanitizeDownloadName(download, safe);
  return new Response(buf, {
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
