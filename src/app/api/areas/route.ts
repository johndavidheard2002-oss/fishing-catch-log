import { NextRequest } from "next/server";
import { listNamedAreas, upsertNamedArea } from "@/lib/db/areas";
import { parseNamedAreaInput } from "@/lib/areas";
import { requireUnlockedViewer } from "@/lib/journal-access";
import { jsonWithViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await requireUnlockedViewer(request);
  if (!access.ok) return access.response;
  const { viewerId } = access;
  const areas = await listNamedAreas(viewerId);
  return jsonWithViewer({ areas }, viewerId);
}

export async function POST(request: NextRequest) {
  const access = await requireUnlockedViewer(request);
  if (!access.ok) return access.response;
  const { viewerId } = access;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseNamedAreaInput(body);
  if (!input) {
    return jsonWithViewer({ error: "Name this area so you can pick it next time." }, viewerId, {
      status: 400,
    });
  }
  const area = await upsertNamedArea(viewerId, input);
  return jsonWithViewer({ area }, viewerId, { status: 201 });
}
