"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CatchForm } from "@/components/CatchForm";

export function LogClient() {
  const params = useSearchParams();
  const router = useRouter();
  const shouldBackfill = params.get("past") === "1" || Boolean(params.get("photo"));

  useEffect(() => {
    if (!shouldBackfill) return;
    const next = new URLSearchParams(params.toString());
    router.replace(`/backfill?${next.toString()}`);
  }, [shouldBackfill, params, router]);

  if (shouldBackfill) {
    return <p className="text-sm text-ink-muted">Opening Backfill…</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-teal">Log a catch</h1>
        <p className="text-sm text-ink-muted">
          Photo, pin, species, count, save. GPS places the pin when the photo has it — drag if
          that isn’t the water. Starts on inshore. Weather fills in from the pin and clock.
        </p>
      </div>
      <CatchForm mode="create" />
    </div>
  );
}
