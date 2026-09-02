import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { HistoryClient } from "@/components/HistoryClient";
import { listCatches } from "@/lib/db/catches";
import { ensureDefaultAngler, getAngler } from "@/lib/db/anglers";
import { ANGLER_COOKIE } from "@/lib/viewer";

export const metadata: Metadata = { title: "Calendar Log" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CalendarLogPage() {
  const jar = await cookies();
  const fromCookie = jar.get(ANGLER_COOKIE)?.value;
  const viewerId = fromCookie && getAngler(fromCookie) ? fromCookie : ensureDefaultAngler().id;
  const initialCatches = listCatches({ viewerId, includeShared: false });

  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Opening Calendar Log…</p>}>
      <HistoryClient initialCatches={initialCatches} initialViewerId={viewerId} />
    </Suspense>
  );
}
