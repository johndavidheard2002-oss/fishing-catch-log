import { Suspense } from "react";
import { BackfillClient } from "@/components/BackfillClient";

export const metadata = { title: "Backfill" };

export default function BackfillPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Opening Backfill…</p>}>
      <BackfillClient />
    </Suspense>
  );
}
