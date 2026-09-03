import { cookies } from "next/headers";
import { PlanClient } from "@/components/PlanClient";
import { ensureDefaultAngler, getAngler } from "@/lib/db/anglers";
import { listCalendarNotes } from "@/lib/db/notes";
import { ANGLER_COOKIE } from "@/lib/viewer";

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
  const jar = await cookies();
  const fromCookie = jar.get(ANGLER_COOKIE)?.value;
  const viewerId = fromCookie && getAngler(fromCookie) ? fromCookie : ensureDefaultAngler().id;
  const initialNotes = listCalendarNotes(viewerId);
  return <PlanClient initialDate={initialDate} initialNotes={initialNotes} />;
}
