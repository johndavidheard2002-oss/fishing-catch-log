import { Suspense } from "react";
import { PlanClient } from "@/components/PlanClient";

export default function PlanPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Loading plan…</p>}>
      <PlanClient />
    </Suspense>
  );
}
