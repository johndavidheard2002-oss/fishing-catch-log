"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CatchForm } from "@/components/CatchForm";

export function LogClient() {
  const params = useSearchParams();
  const past = params.get("past") === "1" || Boolean(params.get("photo"));
  const importedPhotoPath = params.get("photo");
  const importedCaughtAt = params.get("at");
  const afterSave = params.get("next") === "calendar" ? "calendar" : "detail";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-teal">
          {importedPhotoPath
            ? "Finish this catch"
            : past
              ? "Add a past catch"
              : "Log a catch"}
        </h1>
        <p className="text-sm text-ink-muted">
          {importedPhotoPath
            ? "Photo and time came from your library. Pin the water, tag every species, and confirm weather."
            : past
              ? "Backfill from your camera roll. Set the date and time, pin the water, then fill species and weather."
              : "Photo first. Species, weather, and place fill in when they can — everything stays editable."}
        </p>
      </div>
      <div className="journal-card grid grid-cols-3 overflow-hidden rounded-2xl p-1">
        <Link
          href="/log"
          className={`rounded-xl py-2 text-center text-xs font-semibold ${
            !past ? "bg-teal text-white" : "text-ink-muted"
          }`}
        >
          Now
        </Link>
        <Link
          href="/log?past=1"
          className={`rounded-xl py-2 text-center text-xs font-semibold ${
            past && !importedPhotoPath ? "bg-teal text-white" : "text-ink-muted"
          }`}
        >
          Backfill
        </Link>
        <Link
          href="/log/scan"
          className="rounded-xl py-2 text-center text-xs font-semibold text-ink-muted"
        >
          Scan photos
        </Link>
      </div>
      <CatchForm
        mode="create"
        pastMode={past}
        importedPhotoPath={importedPhotoPath}
        importedCaughtAt={importedCaughtAt}
        afterSave={afterSave}
      />
    </div>
  );
}
