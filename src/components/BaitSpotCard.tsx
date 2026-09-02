import Link from "next/link";
import { baitTypesLabel } from "@/lib/bait";
import { baitSpotLabel, yearFromDateKey } from "@/lib/calendar";
import { formatCatchWhen, formatTimeOnly } from "@/lib/time";
import { photoSrc } from "@/lib/photo";
import type { BaitSpot } from "@/lib/types";

export function BaitSpotCard({
  spot,
  compact = false,
  showTime = false,
  showYear = false,
  viewerId,
}: {
  spot: BaitSpot;
  compact?: boolean;
  showTime?: boolean;
  showYear?: boolean;
  viewerId?: string;
}) {
  const src = photoSrc(spot.photoPath);
  const theirs = viewerId && spot.anglerId !== viewerId;
  return (
    <div className="journal-card relative flex overflow-hidden rounded-2xl" data-testid="calendar-bait-entry">
      <Link href={`/bait/${spot.id}`} className="flex min-w-0 flex-1">
        <div className={`relative ${compact ? "h-20 w-20" : "h-24 w-24"} shrink-0 bg-paper-deep`}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center px-1 text-center text-[10px] font-semibold uppercase tracking-wide text-copper">
              Bait
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 px-3 py-2">
          <p className="truncate font-semibold text-ink">{baitTypesLabel(spot.baitTypes)}</p>
          <p className="truncate text-sm text-ink-muted">{baitSpotLabel(spot)}</p>
          <p className="mt-1 truncate text-xs text-ink-muted">
            {showTime ? formatTimeOnly(spot.loggedAt) : formatCatchWhen(spot.loggedAt)}
          </p>
          <p className="mt-1 flex flex-wrap gap-1">
            {showYear ? (
              <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[10px] font-semibold text-teal">
                {yearFromDateKey(spot.loggedAt)}
              </span>
            ) : null}
            <span className="rounded-full bg-copper/15 px-2 py-0.5 text-[10px] font-semibold text-copper">
              Bait
            </span>
            {theirs ? (
              <span className="rounded-full bg-copper/15 px-2 py-0.5 text-[10px] font-semibold text-copper">
                {spot.ownerName}
              </span>
            ) : null}
          </p>
        </div>
      </Link>
    </div>
  );
}
