"use client";

import { BaitSpotCard } from "@/components/BaitSpotCard";
import { CatchCard } from "@/components/CatchCard";
import { DayNotes } from "@/components/CalendarNotes";
import { SpotMap } from "@/components/SpotMap";
import {
  baitSpotLabel,
  baitSpotsOnMonthDay,
  baitSpotsWithPins,
  catchSpotLabel,
  catchesOnMonthDay,
  groupBaitSpotsByDate,
  groupBaitSpotsByYear,
  groupCatchesByDate,
  groupCatchesByYear,
  fullDateLabel,
  monthDayLabel,
  monthGrid,
  monthLabel,
  shiftMonth,
  spotsWithPins,
  todayKey,
  WEEKDAY_LABELS,
  yearFromDateKey,
  yearsOnMonthDay,
} from "@/lib/calendar";
import { baitTypesLabel } from "@/lib/bait";
import { groupSpots } from "@/lib/filters";
import { groupNotesByDay } from "@/lib/notes";
import { photoSrc } from "@/lib/photo";
import { speciesLabel } from "@/lib/species";
import { formatTimeOnly, formatWeekdayDate } from "@/lib/time";
import { catchSpeciesTitle, fishCountLabel } from "@/lib/count";
import type { BaitSpot, CalendarNote, CalendarNoteInput, CatchRecord, SpotGroup } from "@/lib/types";
import Link from "next/link";
import { useEffect, useState } from "react";

export function HistoryCalendar({
  catches,
  baitSpots = [],
  notes = [],
  year,
  month,
  selectedDay,
  onMonthChange,
  onSelectDay,
  onShareDay,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  viewerId,
}: {
  catches: CatchRecord[];
  baitSpots?: BaitSpot[];
  notes?: CalendarNote[];
  year: number;
  month: number;
  selectedDay: string | null;
  onMonthChange: (next: { year: number; month: number }) => void;
  onSelectDay: (date: string) => void;
  onShareDay?: (day: string, shared: boolean) => void | Promise<void>;
  onCreateNote?: (input: CalendarNoteInput) => void | Promise<void>;
  onUpdateNote?: (id: string, input: CalendarNoteInput) => void | Promise<void>;
  onDeleteNote?: (id: string) => void | Promise<void>;
  viewerId?: string;
}) {
  const [thisYearOnlyDay, setThisYearOnlyDay] = useState<string | null>(null);
  const [mapCatch, setMapCatch] = useState<CatchRecord | null>(null);
  const thisYearOnly = Boolean(selectedDay && thisYearOnlyDay === selectedDay);
  const byDate = groupCatchesByDate(catches);
  const byBaitDate = groupBaitSpotsByDate(baitSpots);
  const notesByDay = groupNotesByDay(notes);
  const cells = monthGrid(year, month);
  const today = todayKey();
  const thisYearSelected = selectedDay ? (byDate.get(selectedDay) ?? []) : [];
  const acrossYears = selectedDay ? catchesOnMonthDay(catches, selectedDay) : [];
  const thisYearBait = selectedDay ? (byBaitDate.get(selectedDay) ?? []) : [];
  const acrossYearsBait = selectedDay ? baitSpotsOnMonthDay(baitSpots, selectedDay) : [];
  const yearGroupsAll = groupCatchesByYear(acrossYears);
  const baitYearGroupsAll = groupBaitSpotsByYear(acrossYearsBait);
  const hasOtherYears =
    yearGroupsAll.length > 1 ||
    baitYearGroupsAll.length > 1 ||
    (thisYearSelected.length === 0 && acrossYears.length > 0) ||
    (thisYearBait.length === 0 && acrossYearsBait.length > 0);
  const mappedSpots = spotsWithPins(thisYearSelected);
  const mappedBait = baitSpotsWithPins(thisYearBait);
  const viewYear = selectedDay ? yearFromDateKey(selectedDay) : year;
  const priorCatchGroups = groupCatchesByYear(
    acrossYears.filter((record) => yearFromDateKey(record.caughtAt) !== viewYear),
  );
  const priorBaitGroups = groupBaitSpotsByYear(
    acrossYearsBait.filter((spot) => yearFromDateKey(spot.loggedAt) !== viewYear),
  );
  const showPriorYears = !thisYearOnly && (priorCatchGroups.length > 0 || priorBaitGroups.length > 0);
  const selectedNotes = selectedDay ? (notesByDay.get(selectedDay) ?? []) : [];
  const allYearsLabel = selectedDay
    ? yearsOnMonthDay(catches, baitSpots, selectedDay).join(" · ")
    : "";

  function openDay(date: string) {
    onSelectDay(date);
  }

  return (
    <div className="space-y-3">
      <div className="journal-card rounded-2xl p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => onMonthChange(shiftMonth(year, month, -1))}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-paper text-lg font-semibold"
          >
            ‹
          </button>
          <div className="text-center">
            <p className="font-display text-xl text-teal">{monthLabel(year, month)}</p>
          </div>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => onMonthChange(shiftMonth(year, month, 1))}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-paper text-lg font-semibold"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-ink-muted">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="py-1">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell) => {
            const dayCatches = byDate.get(cell.date) ?? [];
            const count = dayCatches.length;
            const dayBait = byBaitDate.get(cell.date) ?? [];
            const baitCount = dayBait.length;
            const anniversary = cell.inMonth ? catchesOnMonthDay(catches, cell.date) : [];
            const baitAnniversary = cell.inMonth ? baitSpotsOnMonthDay(baitSpots, cell.date) : [];
            const otherYears = anniversary.length > count || baitAnniversary.length > baitCount;
            const yearCount = cell.inMonth ? yearsOnMonthDay(catches, baitSpots, cell.date).length : 0;
            const dayNotes = cell.inMonth ? (notesByDay.get(cell.date) ?? []) : [];
            const planned = dayNotes.length > 0;
            const isSelected = selectedDay === cell.date;
            const isToday = cell.date === today;
            const hasActivity = count > 0 || baitCount > 0 || otherYears || planned;
            return (
              <div
                key={cell.date}
                className={`flex min-h-[4.5rem] flex-col items-center rounded-xl px-0.5 py-1 text-xs ${
                  isSelected
                    ? "bg-teal font-semibold text-white"
                    : isToday
                      ? "ring-1 ring-copper"
                      : ""
                } ${cell.inMonth ? "" : "opacity-35"} ${
                  !isSelected && hasActivity ? "bg-paper-deep" : ""
                } ${!isSelected && planned && count === 0 && baitCount === 0 ? "border border-dashed border-copper/70" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => openDay(cell.date)}
                  aria-label={`${cell.date}${count ? `, ${count} catches` : ""}${
                    baitCount ? `, ${baitCount} bait spot${baitCount === 1 ? "" : "s"}` : ""
                  }${otherYears ? ", other years on this date" : ""}${
                    planned ? `, ${dayNotes.length} planned trip${dayNotes.length === 1 ? "" : "s"}` : ""
                  }`}
                  aria-pressed={isSelected}
                  className="flex w-full flex-1 flex-col items-center leading-none"
                >
                  <span>
                    {cell.day}
                    {otherYears && (count || baitCount) ? (
                      <span
                        className={`ml-0.5 text-[8px] font-bold ${
                          isSelected ? "text-white/80" : "text-copper"
                        }`}
                      >
                        {yearCount}y
                      </span>
                    ) : null}
                  </span>
                  {count ? (
                    <span className="relative">
                      <DayThumbs records={dayCatches} selected={isSelected} />
                      {baitCount ? (
                        <span
                          className={`absolute -left-1 -bottom-0.5 rounded-full px-1 text-[8px] font-bold ${
                            isSelected ? "bg-white text-copper" : "bg-copper text-white"
                          }`}
                          data-testid="calendar-bait-badge"
                        >
                          B
                        </span>
                      ) : null}
                      {planned ? (
                        <span
                          className={`absolute -right-1 -bottom-0.5 rounded-full px-1 text-[8px] font-bold ${
                            isSelected ? "bg-white text-copper" : "bg-copper text-white"
                          }`}
                        >
                          P
                        </span>
                      ) : null}
                    </span>
                  ) : baitCount ? (
                    <span className="relative">
                      <span
                        className={`mt-1 rounded-full px-1.5 text-[9px] font-bold ${
                          isSelected ? "bg-white text-copper" : "bg-copper text-white"
                        }`}
                        data-testid="calendar-bait-badge"
                      >
                        Bait
                      </span>
                      {planned ? (
                        <span
                          className={`absolute -right-1 -bottom-0.5 rounded-full px-1 text-[8px] font-bold ${
                            isSelected ? "bg-white text-copper" : "bg-copper text-white"
                          }`}
                        >
                          P
                        </span>
                      ) : null}
                    </span>
                  ) : otherYears ? (
                    <span
                      className={`mt-1 rounded-full px-1 text-[9px] font-bold ${
                        isSelected ? "bg-white text-teal" : "bg-copper text-white"
                      }`}
                    >
                      {yearCount}y
                    </span>
                  ) : planned ? (
                    <span
                      className={`mt-1 rounded-full px-1.5 text-[9px] font-bold ${
                        isSelected ? "bg-white text-copper" : "bg-copper text-white"
                      }`}
                    >
                      Plan
                    </span>
                  ) : (
                    <span className="mt-1 h-7" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {selectedDay ? (
        <section id="day-detail" data-testid="calendar-day-detail" className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="on-wash-chip w-fit font-display text-xl text-teal">
              {hasOtherYears && !thisYearOnly
                ? monthDayLabel(selectedDay)
                : formatWeekdayDate(selectedDay)}
            </h2>
          </div>
          {hasOtherYears ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="on-wash-chip w-fit text-xs">
                {thisYearOnly
                  ? `${fullDateLabel(selectedDay)} · this year`
                  : `Same date · ${allYearsLabel}`}
              </p>
              <div className="ml-auto grid grid-cols-2 overflow-hidden rounded-full border border-line bg-card p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setThisYearOnlyDay(null)}
                  className={`rounded-full px-2.5 py-1 ${
                    !thisYearOnly ? "bg-teal text-white" : "text-ink-muted"
                  }`}
                >
                  All years
                </button>
                <button
                  type="button"
                  onClick={() => setThisYearOnlyDay(selectedDay)}
                  className={`rounded-full px-2.5 py-1 ${
                    thisYearOnly ? "bg-teal text-white" : "text-ink-muted"
                  }`}
                >
                  This year
                </button>
              </div>
            </div>
          ) : null}
          {thisYearSelected.length === 0 && thisYearBait.length === 0 && !showPriorYears ? (
            <>
              {onCreateNote && onUpdateNote && onDeleteNote ? (
                <DayNotes
                  day={selectedDay}
                  notes={selectedNotes}
                  onCreate={onCreateNote}
                  onUpdate={onUpdateNote}
                  onDelete={onDeleteNote}
                />
              ) : null}
              <p className="on-wash-chip text-sm">
                {thisYearOnly && (acrossYears.length || acrossYearsBait.length)
                  ? `Nothing in ${viewYear}. Other years have trips on this date — switch to All years.`
                  : selectedDay > today
                    ? "No logged catch or bait yet — add a planned trip above. Log the fish from Log or bait from Log bait after the trip."
                    : "No matching catches or bait spots on this day. You can still add a planned-trip note."}
              </p>
            </>
          ) : (
            <>
              <div className="space-y-2" data-testid="calendar-this-year">
                <h3 className="on-wash-chip w-fit font-display text-lg text-teal">
                  {selectedDay ? fullDateLabel(selectedDay) : viewYear} · this year
                </h3>
                {thisYearSelected.length === 0 && thisYearBait.length === 0 ? (
                  <p className="on-wash-chip text-sm">
                    Nothing logged in {viewYear}. Same date in other years is below.
                  </p>
                ) : null}
                {thisYearSelected.map((record) => (
                  <CatchCard
                    key={record.id}
                    record={record}
                    showTime
                    viewerId={viewerId}
                    onOpenMap={() => setMapCatch(record)}
                  />
                ))}
                {thisYearBait.length ? (
                  <div className="space-y-2">
                    <h4 className="on-wash-chip w-fit text-sm font-semibold text-copper">Bait</h4>
                    {thisYearBait.map((spot) => (
                      <BaitSpotCard
                        key={spot.id}
                        spot={spot}
                        compact
                        showTime
                        viewerId={viewerId}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="space-y-1" data-testid="calendar-day-map">
                <p className="on-wash-chip w-fit text-xs font-semibold uppercase tracking-wide">
                  Locations
                </p>
                <SpotMap
                  spots={mappedSpots}
                  baitSpots={mappedBait}
                  selectedKey={null}
                />
                {mappedSpots.length && mappedBait.length ? (
                  <p className="on-wash-chip w-fit text-[11px]">
                    Teal pins are catches. Copper pins are bait holes.
                  </p>
                ) : mappedBait.length && !mappedSpots.length ? (
                  <p className="on-wash-chip w-fit text-[11px]">Copper pins are bait holes.</p>
                ) : null}
                <PinSummary spots={mappedSpots} baitSpots={mappedBait} />
              </div>
              {onCreateNote && onUpdateNote && onDeleteNote ? (
                <DayNotes
                  day={selectedDay}
                  notes={selectedNotes}
                  onCreate={onCreateNote}
                  onUpdate={onUpdateNote}
                  onDelete={onDeleteNote}
                />
              ) : null}
              {onShareDay ? (
                <DayShareToggle
                  day={selectedDay}
                  records={thisYearSelected}
                  viewerId={viewerId}
                  onShareDay={onShareDay}
                  selectedYearOnly={hasOtherYears}
                />
              ) : null}
              {showPriorYears ? (
                <div className="space-y-3 pt-2" data-testid="calendar-prior-years">
                  <h3 className="on-wash-chip w-fit font-display text-lg text-teal">
                    Same date in other years
                  </h3>
                  <p className="on-wash-chip w-fit text-xs text-ink-muted">
                    Below this year’s photo — {allYearsLabel}.
                  </p>
                  {priorCatchGroups.map((group) => (
                    <div key={`prior-${group.year}`} className="space-y-2">
                      <h4 className="on-wash-chip w-fit text-sm font-semibold">
                        {fullDateLabel(group.dateKey)}
                      </h4>
                      {group.catches.map((record) => (
                        <CatchCard
                          key={record.id}
                          record={record}
                          compact
                          showTime
                          showYear
                          viewerId={viewerId}
                          onOpenMap={() => setMapCatch(record)}
                        />
                      ))}
                    </div>
                  ))}
                  {priorBaitGroups.map((group) => (
                    <div key={`prior-bait-${group.year}`} className="space-y-2">
                      <h4 className="on-wash-chip w-fit text-sm font-semibold text-copper">
                        Bait · {fullDateLabel(group.dateKey)}
                      </h4>
                      {group.spots.map((spot) => (
                        <BaitSpotCard
                          key={spot.id}
                          spot={spot}
                          compact
                          showTime
                          showYear
                          viewerId={viewerId}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : (
        <p className="on-wash-chip text-sm">
          Tap a day for its map, logged catches, bait spots, or to add a planned-trip note. No photo
          needed for future days.
        </p>
      )}
      <CalendarCatchMapSheet record={mapCatch} onClose={() => setMapCatch(null)} />
    </div>
  );
}

function CalendarCatchMapSheet({
  record,
  onClose,
}: {
  record: CatchRecord | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!record) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [record, onClose]);

  if (!record) return null;

  const hasPin = record.latitude != null && record.longitude != null;
  const spots = hasPin ? groupSpots([record]) : [];
  const title = catchSpeciesTitle(record);
  const place = catchSpotLabel(record);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-catch-map-title"
      data-testid="calendar-catch-map"
      data-no-tab-swipe
      onClick={onClose}
    >
      <div
        className="journal-card w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 p-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-copper">
              Catch location
            </p>
            <h3 id="calendar-catch-map-title" className="font-display text-xl text-teal">
              {title}
            </h3>
            <p className="mt-1 text-xs text-ink-muted">{place}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-3 py-1 text-xs font-semibold"
          >
            Close
          </button>
        </div>
        <div className="space-y-2 px-3 pb-3">
          {hasPin ? (
            <SpotMap
              spots={spots}
              selectedKey={spots[0]?.key ?? null}
              className="h-72 w-full overflow-hidden rounded-2xl border border-line bg-paper-deep"
            />
          ) : (
            <p
              className="rounded-2xl border border-line bg-paper-deep px-3 py-6 text-sm text-ink-muted"
              data-testid="calendar-catch-map-empty"
            >
              This catch has no saved pin. Open the trip to drop one on the map.
            </p>
          )}
          <Link
            href={`/catch/${record.id}`}
            className="block rounded-2xl border border-line bg-card px-4 py-3 text-center text-sm font-semibold"
          >
            Open catch
          </Link>
        </div>
      </div>
    </div>
  );
}

function DayShareToggle({
  day,
  records,
  viewerId,
  onShareDay,
  selectedYearOnly = false,
}: {
  day: string;
  records: CatchRecord[];
  viewerId?: string;
  onShareDay: (day: string, shared: boolean) => void | Promise<void>;
  selectedYearOnly?: boolean;
}) {
  const mine = records.filter((r) => !viewerId || r.anglerId === viewerId);
  const [busy, setBusy] = useState(false);
  if (!mine.length) return null;
  const allShared = mine.every((r) => r.sharedWithLinked);
  const someShared = mine.some((r) => r.sharedWithLinked);

  return (
    <label className="flex items-start gap-2 rounded-2xl border border-line bg-card px-3 py-2 text-sm">
      <input
        type="checkbox"
        checked={allShared}
        disabled={busy}
        onChange={async (e) => {
          setBusy(true);
          try {
            await onShareDay(day, e.target.checked);
          } finally {
            setBusy(false);
          }
        }}
        className="mt-1"
      />
      <span>
        <span className="font-semibold">Share this day with linked buddies</span>
        <span className="mt-0.5 block text-xs text-ink-muted">
          {allShared
            ? "Linked buddies can see this day’s trips. Uncheck to keep the day private."
            : someShared
              ? "Some trips on this day are already shared. Turn on to share the whole day."
              : "Off until you choose. Linking a buddy does not share this day."}
          {selectedYearOnly
            ? ` Shares ${yearFromDateKey(day)} only — other years on this date stay as they are.`
            : ""}
        </span>
      </span>
    </label>
  );
}

function PinSummary({ spots, baitSpots = [] }: { spots: SpotGroup[]; baitSpots?: BaitSpot[] }) {
  if (!spots.length && !baitSpots.length) return null;
  const catchLine = spots
    .slice()
    .sort((a, b) => {
      const aFirst =
        [...a.catches].sort((x, y) => x.caughtAt.localeCompare(y.caughtAt))[0]?.caughtAt ?? "";
      const bFirst =
        [...b.catches].sort((x, y) => x.caughtAt.localeCompare(y.caughtAt))[0]?.caughtAt ?? "";
      return aFirst.localeCompare(bFirst);
    })
    .map((spot) => `${spot.placeName} · ${fishCountLabel(spot.fishCount)}`)
    .join(" · ");
  const baitLine = [...baitSpots]
    .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt))
    .map((spot) => `Bait · ${baitTypesLabel(spot.baitTypes)} · ${baitSpotLabel(spot)}`)
    .join(" · ");
  const line = [catchLine, baitLine].filter(Boolean).join(" · ");
  return <p className="on-wash-chip w-fit text-xs">{line}</p>;
}

function DayThumbs({
  records,
  selected,
}: {
  records: CatchRecord[];
  selected: boolean;
}) {
  if (!records.length) return <span className="mt-1 h-7" />;
  const shown = records.slice(0, 2);
  const extra = records.length - shown.length;
  const large = records.length === 1;
  return (
    <span className="relative mt-1 flex h-7 w-full items-center justify-center">
      <span className="flex items-center">
        {shown.map((record, i) => {
          const src = photoSrc(record.photoPath);
          const size = large ? "h-7 w-7" : "h-6 w-6";
          return (
            <span
              key={record.id}
              title={`${formatTimeOnly(record.caughtAt)} · ${speciesLabel(record.speciesList?.length ? record.speciesList : record.species)} · ${catchSpotLabel(record)}`}
              className={`relative ${size} overflow-hidden rounded-md border ${
                selected ? "border-white/70" : "border-white"
              } bg-paper`}
              style={{ marginLeft: i === 0 ? 0 : -7, zIndex: shown.length - i }}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="block h-full w-full bg-copper/40" />
              )}
            </span>
          );
        })}
        {extra > 0 ? (
          <span
            className={`relative -ml-1 rounded-full px-1 text-[9px] font-bold ${
              selected ? "bg-white text-teal" : "bg-copper text-white"
            }`}
          >
            +{extra}
          </span>
        ) : null}
      </span>
    </span>
  );
}
