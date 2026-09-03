import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { HistoryClient } from "@/components/HistoryClient";
import { listCatches } from "@/lib/db/catches";
import { listBaitSpots } from "@/lib/db/bait";
import { listCalendarNotes } from "@/lib/db/notes";
import { seedDefaultAngler, getAngler } from "@/lib/db/anglers";
import { ANGLER_COOKIE } from "@/lib/viewer";

export const metadata: Metadata = { title: "Calendar Log" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CalendarLogPage() {
  const jar = await cookies();
  const fromCookie = jar.get(ANGLER_COOKIE)?.value;
  const me = fromCookie ? await getAngler(fromCookie) : null;
  const viewerId = me && fromCookie ? fromCookie : (await seedDefaultAngler()).id;
  const initialCatches = await listCatches({ viewerId, includeShared: false });
  const initialBaitSpots = await listBaitSpots({ viewerId, includeShared: false });
  const initialNotes = await listCalendarNotes(viewerId);

  return (
    <Suspense fallback={<p className="on-wash-chip text-sm">Opening Calendar Log…</p>}>
      <HistoryClient
        initialCatches={initialCatches}
        initialBaitSpots={initialBaitSpots}
        initialNotes={initialNotes}
        initialViewerId={viewerId}
      />
    </Suspense>
  );
}
