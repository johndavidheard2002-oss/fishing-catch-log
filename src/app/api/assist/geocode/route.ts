import { NextRequest } from "next/server";
import { geocodeTown, shouldGeocodeTownQuery } from "@/lib/geocode";
import { requireUnlockedViewer } from "@/lib/journal-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const access = await requireUnlockedViewer(request);
  if (!access.ok) return access.response;
  const body = (await request.json()) as { query?: unknown };
  const query = typeof body.query === "string" ? body.query : "";
  if (!shouldGeocodeTownQuery(query)) {
    return Response.json({ center: null });
  }
  const center = await geocodeTown(query);
  return Response.json({ center });
}
