import { NextRequest } from "next/server";
import { createCalendarNote, listCalendarNotes } from "@/lib/db/notes";
import { parseCalendarNoteInput } from "@/lib/notes";
import { jsonWithViewer, viewerIdFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewerId = viewerIdFromRequest(request);
  const notes = listCalendarNotes(viewerId);
  return jsonWithViewer({ notes }, viewerId);
}

export async function POST(request: NextRequest) {
  const viewerId = viewerIdFromRequest(request);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseCalendarNoteInput(body);
  if (!input) {
    return jsonWithViewer(
      { error: "Add a title, note, place, or species for that day." },
      viewerId,
      { status: 400 },
    );
  }
  const note = createCalendarNote(viewerId, input);
  return jsonWithViewer({ note }, viewerId, { status: 201 });
}
