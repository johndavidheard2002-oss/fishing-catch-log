import { NextRequest } from "next/server";
import { listCatches } from "@/lib/db/catches";
import { catchesToCsv } from "@/lib/csv";
import { ANGLER_COOKIE, includeSharedFrom, viewerIdFromRequest } from "@/lib/viewer";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewerId = viewerIdFromRequest(request);
  const csv = catchesToCsv(
    listCatches({ viewerId, includeShared: includeSharedFrom(request) }),
  );
  const res = new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="cast-log.csv"',
    },
  });
  res.cookies.set(ANGLER_COOKIE, viewerId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}
