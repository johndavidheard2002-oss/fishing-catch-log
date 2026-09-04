import { NextRequest, NextResponse } from "next/server";
import { listCatches } from "@/lib/db/catches";
import { catchesToCsv } from "@/lib/csv";
import { requireViewerId, signInRequired } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewerId = await requireViewerId(request);
  if (!viewerId) return signInRequired();
  const csv = catchesToCsv(
    await listCatches({ viewerId, includeShared: false }),
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="tide-mark.csv"',
    },
  });
}
