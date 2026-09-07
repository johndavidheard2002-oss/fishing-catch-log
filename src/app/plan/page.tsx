import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { JournalUnavailable } from "@/components/JournalUnavailable";
import { Paywall } from "@/components/Paywall";
import { PlanClient } from "@/components/PlanClient";
import { getEntitlementForAngler } from "@/lib/db/entitlement";
import { listCalendarNotes } from "@/lib/db/notes";
import { journalUnlocked } from "@/lib/entitlement";
import { ANGLER_COOKIE, SESSION_COOKIE, resolveViewerFromCookies } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function firstQuery(value?: string | string[]): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string | string[];
    addCatch?: string | string[];
    addBait?: string | string[];
    addPlace?: string | string[];
    addSpecies?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const initialDate = firstQuery(params.date);
  const initialAddCatch = firstQuery(params.addCatch);
  const initialAddBait = firstQuery(params.addBait);
  const initialAddPlace = firstQuery(params.addPlace);
  const initialAddSpecies = firstQuery(params.addSpecies);
  let initialNotes;
  try {
    const jar = await cookies();
    const viewer = await resolveViewerFromCookies(
      jar.get(ANGLER_COOKIE)?.value,
      jar.get(SESSION_COOKIE)?.value,
    );
    if (!viewer.signedIn || !viewer.id) redirect("/signin");
    const entitlement = await getEntitlementForAngler(viewer.id);
    if (!entitlement || !journalUnlocked(entitlement.subscriptionStatus)) {
      return <Paywall entitlement={entitlement} />;
    }
    initialNotes = await listCalendarNotes(viewer.id, { forPlan: true });
  } catch {
    return <JournalUnavailable title="Plan a day" />;
  }
  return (
    <PlanClient
      initialDate={initialDate}
      initialNotes={initialNotes}
      initialAddCatch={initialAddCatch}
      initialAddBait={initialAddBait}
      initialAddPlace={initialAddPlace}
      initialAddSpecies={initialAddSpecies}
    />
  );
}
