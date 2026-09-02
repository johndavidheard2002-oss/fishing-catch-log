import { Suspense } from "react";
import { LogClient } from "@/components/LogClient";

export default function LogPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Opening the log…</p>}>
      <LogClient />
    </Suspense>
  );
}
