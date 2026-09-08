import { Suspense } from "react";
import { CatchViewClient } from "@/components/CatchViewClient";

export default function CatchViewPage() {
  return (
    <Suspense fallback={<p className="on-wash-chip text-sm">Opening the catch…</p>}>
      <CatchViewClient />
    </Suspense>
  );
}
