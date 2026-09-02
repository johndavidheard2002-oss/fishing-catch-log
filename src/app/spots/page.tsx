import { Suspense } from "react";
import { SpotsClient } from "@/components/SpotsClient";

export default function SpotsPage() {
  return (
    <Suspense fallback={<p className="on-wash-chip text-sm">Opening spots…</p>}>
      <SpotsClient />
    </Suspense>
  );
}
