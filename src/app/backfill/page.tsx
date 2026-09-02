import { Suspense } from "react";
import { BackfillClient } from "@/components/BackfillClient";

export const metadata = { title: "Backfill" };

export default function BackfillPage() {
  return (
    <Suspense fallback={<p className="on-wash-chip text-sm">Opening Backfill…</p>}>
      <BackfillClient />
    </Suspense>
  );
}
