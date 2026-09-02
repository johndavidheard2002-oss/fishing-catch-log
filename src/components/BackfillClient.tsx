"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CatchForm } from "@/components/CatchForm";

export function BackfillClient() {
  const params = useSearchParams();
  const importedPhotoPath = params.get("photo");
  const importedCaughtAt = params.get("at");
  const importedPhotoLat = numParam(params.get("plat"));
  const importedPhotoLon = numParam(params.get("plon"));
  const afterSave = params.get("next") === "calendar" ? "calendar" : "detail";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-teal">
          {importedPhotoPath ? "Finish this catch" : "Backfill a past catch"}
        </h1>
        <p className="text-sm text-ink-muted">
          {importedPhotoPath
            ? "Photo and time came from your library. Pin the water, tag every species, and confirm weather."
            : "Past photo, date and time, then pin the water. Species and weather stay editable."}
        </p>
      </div>
      <div className="journal-card grid grid-cols-2 overflow-hidden rounded-2xl p-1">
        <Link
          href="/backfill"
          className="rounded-xl py-2 text-center text-xs font-semibold bg-teal text-white"
        >
          One trip
        </Link>
        <Link
          href="/log/scan"
          className="rounded-xl py-2 text-center text-xs font-semibold text-ink-muted"
        >
          Your photos
        </Link>
      </div>
      <CatchForm
        mode="create"
        pastMode
        importedPhotoPath={importedPhotoPath}
        importedCaughtAt={importedCaughtAt}
        importedPhotoLat={importedPhotoLat}
        importedPhotoLon={importedPhotoLon}
        afterSave={afterSave}
      />
    </div>
  );
}

function numParam(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
