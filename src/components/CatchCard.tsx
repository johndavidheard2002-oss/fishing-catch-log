import Link from "next/link";
import { habitatLabel } from "@/lib/habitat";
import { speciesLabel } from "@/lib/species";
import { formatDateOnly, formatTimeOnly } from "@/lib/time";
import { photoSrc, weatherLine } from "@/lib/photo";
import type { CatchRecord } from "@/lib/types";

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
    <Link
      href={`/catch/${record.id}`}
      className="journal-card flex overflow-hidden rounded-2xl"
    >
      <div className={`${compact ? "h-20 w-20" : "h-24 w-24"} shrink-0 bg-paper-deep`}>
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
        <p className="truncate text-sm text-ink-muted">{record.placeName || "Unnamed spot"}</p>
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
  );
}

export function CatchGridCard({ record }: { record: CatchRecord }) {
  const src = photoSrc(record.photoPath);
  return (
    <Link href={`/catch/${record.id}`} className="journal-card overflow-hidden rounded-2xl">
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
        <p className="truncate text-xs text-ink-muted">{record.placeName || "Unnamed spot"}</p>
        <p className="mt-0.5 text-[10px] text-ink-muted">{habitatLabel(record.habitat)}</p>
      </div>
    </Link>
  );
}
