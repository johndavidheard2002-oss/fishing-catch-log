import { listCatches } from "@/lib/db/catches";
import { groupSpots } from "@/lib/filters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const spots = groupSpots(listCatches());
  return Response.json({ spots });
}
