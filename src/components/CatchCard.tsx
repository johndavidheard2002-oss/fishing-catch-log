import Link from "next/link";
import { SaveToPhotosButton } from "@/components/SaveToPhotosButton";
import { habitatLabel } from "@/lib/habitat";
import { catchSpotLabel } from "@/lib/calendar";
import { speciesLabel } from "@/lib/species";
import { formatDateOnly, formatTimeOnly } from "@/lib/time";
import { catchPhotoFilename, photoSrc, weatherLine } from "@/lib/photo";
import type { CatchRecord } from "@/lib/types";

function photoFilename(record: CatchRecord): string {
  return catchPhotoFilename({
    species: record.speciesList?.length ? record.speciesList : record.species,
    caughtAt: record.caughtAt,
    photoPath: record.photoPath,
  });
}

export function CatchCard({
  record,
  compact = false,
  showTime = false,
  viewerId,
}: {
  record: CatchRecord;
  compact?: boolean;
  showTime?: boolean;
  viewerId?: string;
}) {
  const src = photoSrc(record.photoPath);
  const theirs = viewerId && record.anglerId !== viewerId;
  return (
    <div className="journal-card relative flex overflow-hidden rounded-2xl">
      <Link href={`/catch/${record.id}`} className="flex min-w-0 flex-1">
        <div className={`relative ${compact ? "h-20 w-20" : "h-24 w-24"} shrink-0 bg-paper-deep`}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-ink-muted">
              No photo
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 px-3 py-2">
          <p className="truncate font-semibold text-ink">
            {speciesLabel(record.speciesList?.length ? record.speciesList : record.species)}
          </p>
          <p className="truncate text-sm text-ink-muted">{catchSpotLabel(record)}</p>
          <p className="mt-1 truncate text-xs text-ink-muted">
            {showTime ? formatTimeOnly(record.caughtAt) : formatDateOnly(record.caughtAt)} ·{" "}
            {record.timeOfDay} · {weatherLine(record)}
          </p>
          <p className="mt-1 flex flex-wrap gap-1">
            <span className="rounded-full bg-paper-deep px-2 py-0.5 text-[10px] font-semibold">
              {habitatLabel(record.habitat)}
            </span>
            {theirs ? (
              <span className="rounded-full bg-copper/15 px-2 py-0.5 text-[10px] font-semibold text-copper">
                {record.ownerName}
              </span>
            ) : null}
          </p>
        </div>
      </Link>
      {src ? (
        <SaveToPhotosButton src={src} filename={photoFilename(record)} variant="overlay" />
      ) : null}
    </div>
  );
}

export function CatchGridCard({ record }: { record: CatchRecord }) {
  const src = photoSrc(record.photoPath);
  return (
    <div className="journal-card relative overflow-hidden rounded-2xl">
      <Link href={`/catch/${record.id}`} className="block">
        <div className="aspect-square bg-paper-deep">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-ink-muted">
              No photo
            </div>
          )}
        </div>
        <div className="px-2.5 py-2">
          <p className="truncate text-sm font-semibold">
            {speciesLabel(record.speciesList?.length ? record.speciesList : record.species)}
          </p>
          <p className="truncate text-xs text-ink-muted">{catchSpotLabel(record)}</p>
          <p className="mt-0.5 text-[10px] text-ink-muted">{habitatLabel(record.habitat)}</p>
        </div>
      </Link>
      {src ? (
        <SaveToPhotosButton src={src} filename={photoFilename(record)} variant="overlay" />
      ) : null}
    </div>
  );
}
