import { probeJournalHealth } from "@/lib/db/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const health = await probeJournalHealth();
  return Response.json(health);
}
