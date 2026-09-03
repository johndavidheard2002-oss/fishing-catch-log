import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { JournalUnavailable } from "@/components/JournalUnavailable";
import { PlanClient } from "@/components/PlanClient";
import { listCalendarNotes } from "@/lib/db/notes";
import { ANGLER_COOKIE, SESSION_COOKIE, resolveViewerFromCookies } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.date;
  const initialDate = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
  let initialNotes;
  try {
    const jar = await cookies();
    const viewer = await resolveViewerFromCookies(
      jar.get(ANGLER_COOKIE)?.value,
      jar.get(SESSION_COOKIE)?.value,
    );
    if (!viewer.signedIn || !viewer.id) redirect("/signin");
    initialNotes = await listCalendarNotes(viewer.id);
  } catch {
    return <JournalUnavailable title="Plan a day" />;
  }
  return <PlanClient initialDate={initialDate} initialNotes={initialNotes} />;
}
