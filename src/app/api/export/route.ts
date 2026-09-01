import { listCatches } from "@/lib/db/catches";
import { catchesToCsv } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const csv = catchesToCsv(listCatches());
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"cast-log.csv\"",
    },
  });
}
