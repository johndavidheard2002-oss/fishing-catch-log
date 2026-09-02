"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CatchForm } from "@/components/CatchForm";

export function LogClient() {
  const params = useSearchParams();
  const past = params.get("past") === "1";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-teal">
          {past ? "Add a past catch" : "Log a catch"}
        </h1>
        <p className="text-sm text-ink-muted">
          {past
            ? "Backfill from a camera-roll photo. Set the date, pin the water, and pick freshwater or saltwater first."
            : "Photo first. Species, weather, and place fill in when they can — everything stays editable."}
        </p>
      </div>
      <div className="journal-card grid grid-cols-2 overflow-hidden rounded-2xl p-1">
        <Link
          href="/log"
          className={`rounded-xl py-2 text-center text-xs font-semibold ${
            !past ? "bg-teal text-white" : "text-ink-muted"
          }`}
        >
          Today
        </Link>
        <Link
          href="/log?past=1"
          className={`rounded-xl py-2 text-center text-xs font-semibold ${
            past ? "bg-teal text-white" : "text-ink-muted"
          }`}
        >
          Add past catch
        </Link>
      </div>
      <CatchForm mode="create" pastMode={past} />
    </div>
  );
}
