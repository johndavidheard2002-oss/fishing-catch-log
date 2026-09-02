import { Suspense } from "react";
import type { Metadata } from "next";
import { HistoryClient } from "@/components/HistoryClient";

export const metadata: Metadata = { title: "Calendar Log" };

export default function CalendarLogPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Opening Calendar Log…</p>}>
      <HistoryClient />
    </Suspense>
  );
}
