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
          Photo first. If the picture has a location stamp, we drop a catch pin there — drag it if
          that isn’t the water. Pick every species from the list (starts on saltwater). Weather
          fills in when it can. A second fish today can be a different lake; this pin is only for
          this catch.
        </p>
      </div>
      <CatchForm mode="create" />
    </div>
  );
}
