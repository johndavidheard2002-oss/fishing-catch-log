import { NextRequest } from "next/server";
import { createCatch, listCatches } from "@/lib/db/catches";
import { matchesFilters, parseFilters } from "@/lib/filters";
import { catchInputFromUnknown } from "@/lib/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const filters = parseFilters(request.nextUrl.searchParams);
  const records = listCatches().filter((c) => matchesFilters(c, filters));
  return Response.json({ catches: records });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const input = catchInputFromUnknown(body);
  const record = createCatch(input);
  return Response.json({ catch: record }, { status: 201 });
}
