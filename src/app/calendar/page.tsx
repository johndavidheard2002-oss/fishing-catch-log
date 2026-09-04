import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { HistoryClient } from "@/components/HistoryClient";
import { JournalUnavailable } from "@/components/JournalUnavailable";
import { Paywall } from "@/components/Paywall";
import { listCatches } from "@/lib/db/catches";
import { listBaitSpots } from "@/lib/db/bait";
import { getEntitlementForAngler } from "@/lib/db/entitlement";
import { listCalendarNotes } from "@/lib/db/notes";
import { journalUnlocked } from "@/lib/entitlement";
import { redirect } from "next/navigation";
import { ANGLER_COOKIE, SESSION_COOKIE, resolveViewerFromCookies } from "@/lib/viewer";

export const metadata: Metadata = { title: "Calendar Log" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CalendarLogPage() {
  let viewerId: string;
  let initialCatches;
  let initialBaitSpots;
  let initialNotes;
  try {
    const jar = await cookies();
    const viewer = await resolveViewerFromCookies(
      jar.get(ANGLER_COOKIE)?.value,
      jar.get(SESSION_COOKIE)?.value,
    );
    if (!viewer.signedIn || !viewer.id) redirect("/signin");
    viewerId = viewer.id;
    const entitlement = await getEntitlementForAngler(viewerId);
    if (!entitlement || !journalUnlocked(entitlement.subscriptionStatus)) {
      return <Paywall entitlement={entitlement} />;
    }
    initialCatches = await listCatches({ viewerId, includeShared: false });
    initialBaitSpots = await listBaitSpots({ viewerId, includeShared: false });
    initialNotes = await listCalendarNotes(viewerId);
  } catch {
    return <JournalUnavailable title="Calendar Log" />;
  }

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
