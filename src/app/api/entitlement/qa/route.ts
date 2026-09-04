import { NextRequest, NextResponse } from "next/server";
import { DAY_MS } from "@/lib/entitlement";
import { parseQaStatus, setStoredSubscription } from "@/lib/db/entitlement";
import { jsonWithViewer, requireViewerId, signInRequired } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function qaSecret(): string {
  return process.env.TIDEMARK_QA_SECRET?.trim() || "";
}

/**
 * QA-only: force this signed-in journal to expired / trial / active.
 * Requires TIDEMARK_QA_SECRET and the same value in `secret` (body or x-tidemark-qa).
 * Never expose a public unlock control in the UI.
 */
export async function POST(request: NextRequest) {
  const expected = qaSecret();
  if (!expected) {
    return NextResponse.json({ error: "QA entitlement is not enabled." }, { status: 404 });
  }
  const viewerId = await requireViewerId(request);
  if (!viewerId) return signInRequired();
  const body = (await request.json().catch(() => ({}))) as {
    secret?: unknown;
    status?: unknown;
    trialDaysAgo?: unknown;
    trialStartedAt?: unknown;
  };
  const provided =
    (typeof body.secret === "string" && body.secret) ||
    request.headers.get("x-tidemark-qa") ||
    "";
  if (provided !== expected) {
    return jsonWithViewer({ error: "QA secret did not match." }, viewerId, { status: 403 }, true);
  }
  const status = parseQaStatus(body.status);
  if (body.status != null && !status) {
    return jsonWithViewer({ error: "status must be trial, active, or expired." }, viewerId, { status: 400 }, true);
  }
  let trialStartedAt: string | undefined;
  if (typeof body.trialStartedAt === "string" && body.trialStartedAt) {
    trialStartedAt = body.trialStartedAt;
  } else if (typeof body.trialDaysAgo === "number" && Number.isFinite(body.trialDaysAgo)) {
    trialStartedAt = new Date(Date.now() - body.trialDaysAgo * DAY_MS).toISOString();
  } else if (status === "expired") {
    trialStartedAt = new Date(Date.now() - 31 * DAY_MS).toISOString();
  }
  const entitlement = await setStoredSubscription(viewerId, {
    status: status ?? undefined,
    trialStartedAt,
  });
  return jsonWithViewer({ ok: true, entitlement }, viewerId, undefined, true);
}
