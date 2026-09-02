import { Suspense } from "react";
import { SpotsClient } from "@/components/SpotsClient";

export default function SpotsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Opening spots…</p>}>
      <SpotsClient />
    </Suspense>
  );
}
