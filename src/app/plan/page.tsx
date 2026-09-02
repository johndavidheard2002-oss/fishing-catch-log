import { Suspense } from "react";
import { PlanClient } from "@/components/PlanClient";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.date;
  const initialDate = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Loading plan…</p>}>
      <PlanClient initialDate={initialDate} />
    </Suspense>
  );
}
