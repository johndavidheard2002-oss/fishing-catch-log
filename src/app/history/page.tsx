import { Suspense } from "react";
import { HistoryClient } from "@/components/HistoryClient";

export default function HistoryPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Loading history…</p>}>
      <HistoryClient />
    </Suspense>
  );
}
