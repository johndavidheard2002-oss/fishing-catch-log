import { NextRequest } from "next/server";
import {
  createCalendarNote,
  deleteCalendarNotesForDay,
  listCalendarNotes,
  planSourceJournalForNotes,
} from "@/lib/db/notes";
import { parseCalendarNoteInput, parseDayKey, utcTodayKey } from "@/lib/notes";
import { requireUnlockedViewer } from "@/lib/journal-access";
import { includeSharedFrom, jsonWithViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await requireUnlockedViewer(request);
  if (!access.ok) return access.response;
  const { viewerId } = access;
  const forPlan = request.nextUrl.searchParams.get("for") === "plan";
  const includePlanSpots = request.nextUrl.searchParams.get("include") === "plan-spots";
  const includeShared = forPlan && includeSharedFrom(request);
  const today = parseDayKey(request.nextUrl.searchParams.get("today")) ?? undefined;
  const notes = await listCalendarNotes(viewerId, {
    forPlan,
    includePlanSpots,
    includeShared,
    today,
    serverToday: utcTodayKey(),
  });
  if (!includeShared) return jsonWithViewer({ notes }, viewerId);
  const journal = await planSourceJournalForNotes(notes);
  return jsonWithViewer({ notes, catches: journal.catches, spots: journal.baitSpots }, viewerId);
}

export async function POST(request: NextRequest) {
  const access = await requireUnlockedViewer(request);
  if (!access.ok) return access.response;
  const { viewerId } = access;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseCalendarNoteInput(body);
  if (!input) {
    return jsonWithViewer(
      { error: "Add a title, note, place, or species for that day." },
      viewerId,
      { status: 400 },
    );
  }
  const note = await createCalendarNote(viewerId, input);
  return jsonWithViewer({ note }, viewerId, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const access = await requireUnlockedViewer(request);
  if (!access.ok) return access.response;
  const { viewerId } = access;
  const day = parseDayKey(request.nextUrl.searchParams.get("day"));
  if (!day) {
    return jsonWithViewer({ error: "Pick a day to delete." }, viewerId, { status: 400 });
  }
  const deleted = await deleteCalendarNotesForDay(viewerId, day);
  return jsonWithViewer({ ok: true, deleted }, viewerId);
}
