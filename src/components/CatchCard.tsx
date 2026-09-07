import Link from "next/link";
import { AddToPlanButton } from "@/components/AddToPlanButton";
import { SaveToPhotosButton } from "@/components/SaveToPhotosButton";
import { SharedOwnerBadge } from "@/components/SharedOwnerBadge";
import { habitatLabel } from "@/lib/habitat";
import { catchSpotLabel, yearFromDateKey } from "@/lib/calendar";
import { formatCatchWhen, formatTimeOnly, TIME_OF_DAY_LABELS } from "@/lib/time";
import { catchSpeciesTitle } from "@/lib/count";
import { canShowAddToPlan, pendingPlanSpotFromCatch } from "@/lib/pending-plan-spot";
import { catchPhotoFilename, isSampleCatchPhoto, photoSrc, weatherLine } from "@/lib/photo";
import type { CatchRecord } from "@/lib/types";

function photoFilename(record: CatchRecord): string {
  return catchPhotoFilename({
    species: record.speciesList?.length ? record.speciesList : record.species,
    caughtAt: record.caughtAt,
    photoPath: record.photoPath,
  });
}

function CatchStampChips({
  record,
  showYear,
  addToPlan,
}: {
  record: CatchRecord;
  showYear?: boolean;
  addToPlan: boolean;
}) {
  const pending = addToPlan ? pendingPlanSpotFromCatch(record) : null;
  return (
    <p className="flex flex-wrap items-center gap-1">
      {showYear ? (
        <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[10px] font-semibold text-teal">
          {yearFromDateKey(record.caughtAt)}
        </span>
      ) : null}
      <span className="rounded-full bg-paper-deep px-2 py-0.5 text-[10px] font-semibold">
        {habitatLabel(record.habitat)}
      </span>
      {record.timeOfDay ? (
        <span className="rounded-full bg-paper-deep px-2 py-0.5 text-[10px] font-semibold">
          {TIME_OF_DAY_LABELS[record.timeOfDay]}
        </span>
      ) : null}
      {record.moonPhase ? (
        <span className="rounded-full bg-paper-deep px-2 py-0.5 text-[10px] font-semibold">
          {record.moonPhase}
        </span>
      ) : null}
      {isSampleCatchPhoto(record.photoPath) ? (
        <span className="rounded-full bg-paper-deep px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
          Sample
        </span>
      ) : null}
      {pending ? <AddToPlanButton spot={pending} /> : null}
    </p>
  );
}

export function CatchCard({
  record,
  compact = false,
  showTime = false,
  showYear = false,
  viewerId,
  showAddToPlan = false,
}: {
  record: CatchRecord;
  compact?: boolean;
  showTime?: boolean;
  showYear?: boolean;
  viewerId?: string;
  showAddToPlan?: boolean;
}) {
  const src = photoSrc(record.photoPath);
  const theirs = viewerId && record.anglerId !== viewerId;
  const addToPlan = canShowAddToPlan(record, viewerId, showAddToPlan);
  return (
    <div className="journal-card relative flex min-w-0 overflow-visible rounded-2xl">
      <Link
        href={`/catch/${record.id}`}
        className={`relative ${compact ? "h-20 w-20" : "h-24 w-24"} shrink-0 overflow-hidden bg-paper-deep`}
        data-testid="calendar-catch-open"
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-ink-muted">
            No photo
          </div>
        )}
        {theirs ? <SharedOwnerBadge name={record.ownerName} compact={compact} /> : null}
      </Link>
      <div className="min-w-0 flex-1 px-3 py-2">
        <Link href={`/catch/${record.id}`} className="block min-w-0" data-testid="calendar-catch-open">
          <p className="truncate font-semibold text-ink">
            {catchSpeciesTitle(record)}
            {record.speciesCounts?.length > 1
              ? ""
              : compact || record.fishCount > 1
                ? ` · ${record.fishCount}`
                : ""}
          </p>
          <p className="truncate text-sm text-ink-muted">{catchSpotLabel(record)}</p>
          <p className="mt-1 truncate text-xs text-ink-muted">
            {showTime ? formatTimeOnly(record.caughtAt) : formatCatchWhen(record.caughtAt)} ·{" "}
            {weatherLine(record)}
          </p>
        </Link>
        <div className="mt-1" data-testid={addToPlan ? "add-to-plan-photo-chips" : undefined}>
          <CatchStampChips record={record} showYear={showYear} addToPlan={addToPlan} />
        </div>
      </div>
      {src ? (
        <SaveToPhotosButton src={src} filename={photoFilename(record)} variant="overlay" />
      ) : null}
    </div>
  );
}

export function CatchGridCard({
  record,
  viewerId,
  showAddToPlan = false,
}: {
  record: CatchRecord;
  viewerId?: string;
  showAddToPlan?: boolean;
}) {
  const src = photoSrc(record.photoPath);
  const theirs = viewerId && record.anglerId !== viewerId;
  const addToPlan = canShowAddToPlan(record, viewerId, showAddToPlan);
  return (
    <div className="journal-card relative min-w-0 overflow-hidden rounded-2xl">
      <div className="relative aspect-square overflow-hidden bg-paper-deep">
        <Link href={`/catch/${record.id}`} className="absolute inset-0" data-testid="calendar-catch-open">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-ink-muted">
              No photo
            </div>
          )}
          {theirs ? <SharedOwnerBadge name={record.ownerName} /> : null}
        </Link>
      </div>
      {addToPlan ? (
        <div className="px-2.5 pt-2" data-testid="add-to-plan-photo-chips">
          <CatchStampChips record={record} addToPlan />
        </div>
      ) : null}
      <Link href={`/catch/${record.id}`} className="block px-2.5 py-2" data-testid="calendar-catch-open">
        <p className="truncate text-sm font-semibold">
          {catchSpeciesTitle(record)}
          {record.speciesCounts?.length > 1 || record.fishCount <= 1
            ? ""
            : ` · ${record.fishCount}`}
        </p>
        <p className="truncate text-xs text-ink-muted">{catchSpotLabel(record)}</p>
        <p className="mt-0.5 text-[10px] text-ink-muted">
          {formatCatchWhen(record.caughtAt)} · {habitatLabel(record.habitat)}
          {isSampleCatchPhoto(record.photoPath) ? " · Sample" : ""}
        </p>
      </Link>
      {src ? (
        <SaveToPhotosButton src={src} filename={photoFilename(record)} variant="overlay" />
      ) : null}
    </div>
  );
}
