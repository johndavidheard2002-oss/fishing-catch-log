import { Suspense } from "react";
import { LogClient } from "@/components/LogClient";

export default function LogPage() {
  return (
    <Suspense fallback={<p className="on-wash-chip text-sm">Opening the log…</p>}>
      <LogClient />
    </Suspense>
  );
}
