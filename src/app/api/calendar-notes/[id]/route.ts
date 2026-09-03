import { NextRequest } from "next/server";
import { deleteCalendarNote, getCalendarNote, updateCalendarNote } from "@/lib/db/notes";
import { parseCalendarNoteInput } from "@/lib/notes";
import { jsonWithViewer, requireViewerId, signInRequired } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const viewerId = await requireViewerId(request);
  if (!viewerId) return signInRequired();
  const { id } = await ctx.params;
  const existing = await getCalendarNote(id);
  if (!existing || existing.anglerId !== viewerId) {
    return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseCalendarNoteInput({ ...body, day: body.day ?? existing.day });
  if (!input) {
    return jsonWithViewer(
      { error: "Add a title, note, place, or species for that day." },
      viewerId,
      { status: 400 },
    );
  }
  const note = await updateCalendarNote(id, viewerId, input);
  if (!note) return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  return jsonWithViewer({ note }, viewerId);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const viewerId = await requireViewerId(request);
  if (!viewerId) return signInRequired();
  const { id } = await ctx.params;
  const ok = await deleteCalendarNote(id, viewerId);
  if (!ok) return jsonWithViewer({ error: "Not found" }, viewerId, { status: 404 });
  return jsonWithViewer({ ok: true }, viewerId);
}
