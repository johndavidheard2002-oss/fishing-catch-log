import { NextRequest } from "next/server";
import { createCatch, listCatches } from "@/lib/db/catches";
import { matchesFilters, parseFilters } from "@/lib/filters";
import { catchInputFromUnknown } from "@/lib/parse";
import { requireUnlockedViewer } from "@/lib/journal-access";
import { includeSharedFrom, jsonWithViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await requireUnlockedViewer(request);
  if (!access.ok) return access.response;
  const { viewerId } = access;
  const filters = parseFilters(request.nextUrl.searchParams);
  const records = (await listCatches({
    viewerId,
    includeShared: includeSharedFrom(request),
  })).filter((c) => matchesFilters(c, filters));
  return jsonWithViewer({ catches: records }, viewerId);
}

export async function POST(request: NextRequest) {
  const access = await requireUnlockedViewer(request);
  if (!access.ok) return access.response;
  const { viewerId } = access;
  const body = (await request.json()) as Record<string, unknown>;
  const input = catchInputFromUnknown(body);
  const record = await createCatch({ ...input, anglerId: viewerId });
  return jsonWithViewer({ catch: record }, viewerId, { status: 201 });
}
