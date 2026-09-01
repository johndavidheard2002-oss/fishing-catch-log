import { NextRequest } from "next/server";
import { listCatches } from "@/lib/db/catches";
import { buildPlan } from "@/lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const raw = Number(request.nextUrl.searchParams.get("days") ?? "5");
  const days = [3, 5, 7].includes(raw) ? raw : 5;
  const plan = await buildPlan(listCatches(), days);
  return Response.json(plan);
}
