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
      <div className="page-intro">
        <h1 className="font-display text-3xl text-teal">
          {importedPhotoPath ? "Finish this catch" : "Backfill a past catch"}
        </h1>
      </div>
      {!importedPhotoPath ? (
        <Link
          href="/log/scan"
          data-testid="backfill-find-fish"
          className="block rounded-2xl bg-copper px-4 py-3 text-center text-lg font-semibold text-white"
        >
          Find fish photos
        </Link>
      ) : null}
      <CatchForm
        key={importedPhotoPath ?? "new-trip"}
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
