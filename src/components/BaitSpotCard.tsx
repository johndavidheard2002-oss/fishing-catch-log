import Link from "next/link";
import { AddToPlanButton } from "@/components/AddToPlanButton";
import { SharedOwnerBadge } from "@/components/SharedOwnerBadge";
import { baitTypesLabel } from "@/lib/bait";
import { habitatLabel } from "@/lib/habitat";
import { baitSpotLabel, yearFromDateKey } from "@/lib/calendar";
import { formatCatchWhen, formatTimeOnly, TIME_OF_DAY_LABELS } from "@/lib/time";
import { canShowAddToPlan, pendingPlanSpotFromBait } from "@/lib/pending-plan-spot";
import { personalPhotoSrc, weatherLine } from "@/lib/photo";
import type { BaitSpot } from "@/lib/types";

function BaitStampChips({
  spot,
  showYear,
  addToPlan,
}: {
  spot: BaitSpot;
  showYear?: boolean;
  addToPlan: boolean;
}) {
  const pending = addToPlan ? pendingPlanSpotFromBait(spot) : null;
  return (
    <p className="flex flex-wrap gap-1">
      {showYear ? (
        <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[10px] font-semibold text-teal">
          {yearFromDateKey(spot.loggedAt)}
        </span>
      ) : null}
      <span className="rounded-full bg-copper/15 px-2 py-0.5 text-[10px] font-semibold text-copper">
        Bait
      </span>
      {spot.habitat ? (
        <span className="rounded-full bg-paper-deep px-2 py-0.5 text-[10px] font-semibold">
          {habitatLabel(spot.habitat)}
        </span>
      ) : null}
      {pending ? <AddToPlanButton spot={pending} /> : null}
      {spot.timeOfDay ? (
        <span className="rounded-full bg-paper-deep px-2 py-0.5 text-[10px] font-semibold">
          {TIME_OF_DAY_LABELS[spot.timeOfDay]}
        </span>
      ) : null}
      {spot.moonPhase ? (
        <span className="rounded-full bg-paper-deep px-2 py-0.5 text-[10px] font-semibold">
          {spot.moonPhase}
        </span>
      ) : null}
    </p>
  );
}

export function BaitSpotCard({
  spot,
  compact = false,
  showTime = false,
  showYear = false,
  viewerId,
  showAddToPlan = false,
}: {
  spot: BaitSpot;
  compact?: boolean;
  showTime?: boolean;
  showYear?: boolean;
  viewerId?: string;
  showAddToPlan?: boolean;
}) {
  const src = personalPhotoSrc(spot.photoPath);
  const theirs = viewerId && spot.anglerId !== viewerId;
  const badge = theirs ? <SharedOwnerBadge name={spot.ownerName} compact={compact} /> : null;
  const addToPlan = canShowAddToPlan(spot, viewerId, showAddToPlan);
  const chipsOnPhoto = Boolean(src && addToPlan);
  return (
    <div className="journal-card relative flex overflow-hidden rounded-2xl" data-testid="calendar-bait-entry">
      {src ? (
        <Link
          href={`/bait/${spot.id}`}
          className={`relative ${compact ? "h-20 w-20" : "h-24 w-24"} shrink-0 overflow-hidden bg-paper-deep`}
          data-testid="calendar-bait-open"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="h-full w-full object-cover" data-testid="bait-photo" />
          {badge}
        </Link>
      ) : null}
      <div className={`min-w-0 flex-1 px-3 pt-2 ${chipsOnPhoto ? "pb-8" : "pb-2"}`}>
        <Link href={`/bait/${spot.id}`} className="block min-w-0" data-testid="calendar-bait-open">
          <p className="truncate font-semibold text-ink">{baitTypesLabel(spot.baitTypes)}</p>
          <p className="truncate text-sm text-ink-muted">{baitSpotLabel(spot)}</p>
          <p className="mt-1 truncate text-xs text-ink-muted">
            {showTime ? formatTimeOnly(spot.loggedAt) : formatCatchWhen(spot.loggedAt)} ·{" "}
            {weatherLine(spot)}
          </p>
        </Link>
        {chipsOnPhoto ? null : (
          <div className="mt-1">
            <BaitStampChips spot={spot} showYear={showYear} addToPlan={addToPlan} />
          </div>
        )}
      </div>
      {chipsOnPhoto ? (
        <div className="absolute inset-x-2 bottom-2 z-10" data-testid="add-to-plan-photo-chips">
          <BaitStampChips spot={spot} showYear={showYear} addToPlan />
        </div>
      ) : null}
      {!src ? badge : null}
    </div>
  );
}

export function BaitSpotGridCard({
  spot,
  viewerId,
  showAddToPlan = false,
}: {
  spot: BaitSpot;
  viewerId?: string;
  showAddToPlan?: boolean;
}) {
  const src = personalPhotoSrc(spot.photoPath);
  const theirs = viewerId && spot.anglerId !== viewerId;
  const badge = theirs ? <SharedOwnerBadge name={spot.ownerName} /> : null;
  const addToPlan = canShowAddToPlan(spot, viewerId, showAddToPlan);
  const pending = addToPlan ? pendingPlanSpotFromBait(spot) : null;
  return (
    <div className="journal-card relative overflow-hidden rounded-2xl" data-testid="calendar-bait-entry">
      {src ? (
        <div className="relative aspect-square overflow-hidden bg-paper-deep">
          <Link href={`/bait/${spot.id}`} className="absolute inset-0" data-testid="calendar-bait-open">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" data-testid="bait-photo" />
            {badge}
          </Link>
          {pending ? (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-wrap gap-1 bg-gradient-to-t from-ink/70 to-transparent p-1.5 pt-6"
              data-testid="add-to-plan-photo-chips"
            >
              <span className="rounded-full bg-copper/15 px-2 py-0.5 text-[10px] font-semibold text-copper">
                Bait
              </span>
              {spot.habitat ? (
                <span className="rounded-full bg-paper-deep px-2 py-0.5 text-[10px] font-semibold">
                  {habitatLabel(spot.habitat)}
                </span>
              ) : null}
              <span className="pointer-events-auto">
                <AddToPlanButton spot={pending} />
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
      <Link href={`/bait/${spot.id}`} className="block px-2.5 py-2" data-testid="calendar-bait-open">
        <p className="truncate text-sm font-semibold">{baitTypesLabel(spot.baitTypes)}</p>
        <p className="truncate text-xs text-ink-muted">{baitSpotLabel(spot)}</p>
        <p className="mt-0.5 text-[10px] text-ink-muted">
          {formatCatchWhen(spot.loggedAt)} · Bait
        </p>
      </Link>
      {!src && pending ? (
        <div className="px-2.5 pb-2">
          <BaitStampChips spot={spot} addToPlan />
        </div>
      ) : null}
      {!src ? badge : null}
    </div>
  );
}
