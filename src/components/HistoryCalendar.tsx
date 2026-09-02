"use client";

import { CatchCard } from "@/components/CatchCard";
import { DayNotes } from "@/components/CalendarNotes";
import { SpotMap } from "@/components/SpotMap";
import {
  catchSpotLabel,
  catchesOnMonthDay,
  groupCatchesByDate,
  groupCatchesByYear,
  monthDayLabel,
  monthGrid,
  monthLabel,
  shiftMonth,
  spotsWithPins,
  todayKey,
  WEEKDAY_LABELS,
  yearFromDateKey,
} from "@/lib/calendar";
import { groupNotesByDay } from "@/lib/notes";
import { photoSrc } from "@/lib/photo";
import { speciesLabel } from "@/lib/species";
import { formatTimeOnly, formatWeekdayDate } from "@/lib/time";
import { fishCountLabel } from "@/lib/count";
import type { CalendarNote, CalendarNoteInput, CatchRecord, SpotGroup } from "@/lib/types";
import { useEffect, useState } from "react";

export function HistoryCalendar({
  catches,
  notes = [],
  year,
  month,
  selectedDay,
  autoOpenMapDay = null,
  onMonthChange,
  onSelectDay,
  onShareDay,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  viewerId,
}: {
  catches: CatchRecord[];
  notes?: CalendarNote[];
  year: number;
  month: number;
  selectedDay: string | null;
  autoOpenMapDay?: string | null;
  onMonthChange: (next: { year: number; month: number }) => void;
  onSelectDay: (date: string) => void;
  onShareDay?: (day: string, shared: boolean) => void | Promise<void>;
  onCreateNote?: (input: CalendarNoteInput) => void | Promise<void>;
  onUpdateNote?: (id: string, input: CalendarNoteInput) => void | Promise<void>;
  onDeleteNote?: (id: string) => void | Promise<void>;
  viewerId?: string;
}) {
  const [thisYearOnlyDay, setThisYearOnlyDay] = useState<string | null>(null);
  const [mapDay, setMapDay] = useState<string | null>(autoOpenMapDay);
  const thisYearOnly = Boolean(selectedDay && thisYearOnlyDay === selectedDay);
  const byDate = groupCatchesByDate(catches);
  const notesByDay = groupNotesByDay(notes);
  const cells = monthGrid(year, month);
  const today = todayKey();
  const thisYearSelected = selectedDay ? (byDate.get(selectedDay) ?? []) : [];
  const acrossYears = selectedDay ? catchesOnMonthDay(catches, selectedDay) : [];
  const yearGroupsAll = groupCatchesByYear(acrossYears);
  const hasOtherYears = yearGroupsAll.length > 1 || (thisYearSelected.length === 0 && acrossYears.length > 0);
  const selected = thisYearOnly ? thisYearSelected : acrossYears;
  const yearGroups = groupCatchesByYear(selected);
  const mappedSpots = spotsWithPins(selected);
  const showYearLabels = !thisYearOnly && hasOtherYears;
  const popupRecords =
    mapDay == null
      ? []
      : thisYearOnly && mapDay === selectedDay
        ? (byDate.get(mapDay) ?? [])
        : catchesOnMonthDay(catches, mapDay);
  const popupSpots = spotsWithPins(popupRecords);
  const popupOpen = Boolean(mapDay && popupSpots.length);
  const selectedNotes = selectedDay ? (notesByDay.get(selectedDay) ?? []) : [];

  function openDay(date: string) {
    onSelectDay(date);
    setMapDay(date);
  }

  useEffect(() => {
    if (!popupOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMapDay(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popupOpen]);

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
            const anniversary = cell.inMonth ? catchesOnMonthDay(catches, cell.date) : [];
            const otherYears = anniversary.length > count;
            const dayNotes = cell.inMonth ? (notesByDay.get(cell.date) ?? []) : [];
            const planned = dayNotes.length > 0;
            const isSelected = selectedDay === cell.date;
            const isToday = cell.date === today;
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
                  !isSelected && (count > 0 || otherYears || planned) ? "bg-paper-deep" : ""
                } ${!isSelected && planned && count === 0 ? "border border-dashed border-copper/70" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => openDay(cell.date)}
                  aria-label={`${cell.date}${count ? `, ${count} catches` : ""}${
                    otherYears ? ", other years on this date" : ""
                  }${planned ? `, ${dayNotes.length} planned trip${dayNotes.length === 1 ? "" : "s"}` : ""}`}
                  aria-pressed={isSelected}
                  className="flex w-full flex-1 flex-col items-center leading-none"
                >
                  <span>
                    {cell.day}
                    {otherYears && count ? (
                      <span
                        className={`ml-0.5 text-[8px] font-bold ${
                          isSelected ? "text-white/80" : "text-copper"
                        }`}
                      >
                        {groupCatchesByYear(anniversary).length}y
                      </span>
                    ) : null}
                  </span>
                  {count ? (
                    <span className="relative">
                      <DayThumbs records={dayCatches} selected={isSelected} />
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
                      {groupCatchesByYear(anniversary).length}y
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
        <section id="day-detail" className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-display text-xl text-teal">
              {hasOtherYears && !thisYearOnly
                ? monthDayLabel(selectedDay)
                : formatWeekdayDate(selectedDay)}
            </h2>
            {mappedSpots.length ? (
              <button
                type="button"
                onClick={() => setMapDay(selectedDay)}
                className="rounded-full bg-teal px-3 py-1 text-xs font-semibold text-white"
              >
                {popupOpen ? "Map open" : "Open map"}
              </button>
            ) : null}
          </div>
          {selected.length === 0 ? null : mappedSpots.length ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Catch locations
              </p>
              <SpotMap
                spots={mappedSpots}
                selectedKey={null}
                className="h-72 w-full overflow-hidden rounded-2xl border border-line bg-paper-deep"
              />
              <PinSummary spots={mappedSpots} />
            </div>
          ) : (
            <p className="rounded-2xl border border-line bg-card px-3 py-3 text-sm text-ink-muted">
              No map pins this date — those trips have no saved location.
            </p>
          )}
          {hasOtherYears ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-ink-muted">
                {thisYearOnly
                  ? yearFromDateKey(selectedDay)
                  : `Same date · ${yearGroupsAll.map((g) => g.year).join(" · ")}`}
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
          {selected.length === 0 ? (
            <p className="text-sm text-ink-muted">
              {thisYearOnly && acrossYears.length
                ? `Nothing in ${yearFromDateKey(selectedDay)}. Other years have trips on this date — switch to All years.`
                : selectedDay > today
                  ? "No logged catch yet — add a planned trip above. Log the fish from Log or Backfill after the trip."
                  : "No matching catches on this day. You can still add a planned-trip note."}
            </p>
          ) : (
            yearGroups.map((group) => (
              <div key={group.year} className="space-y-2">
                {showYearLabels ? (
                  <h3 className="pt-1 font-display text-lg text-teal">{group.year}</h3>
                ) : null}
                {group.catches.map((record) => (
                  <CatchCard
                    key={record.id}
                    record={record}
                    compact
                    showTime
                    showYear={showYearLabels}
                    viewerId={viewerId}
                  />
                ))}
              </div>
            ))
          )}
        </section>
      ) : (
        <p className="text-sm text-ink-muted">
          Tap a day for its map, logged catches, or to add a planned-trip note. No photo needed for
          future days.
        </p>
      )}
      {popupOpen && mapDay ? (
        <DayMapPopup
          day={mapDay}
          spots={popupSpots}
          thisYearOnly={thisYearOnly && mapDay === selectedDay}
          onClose={() => setMapDay(null)}
        />
      ) : null}
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

function DayMapPopup({
  day,
  spots,
  thisYearOnly,
  onClose,
}: {
  day: string;
  spots: SpotGroup[];
  thisYearOnly: boolean;
  onClose: () => void;
}) {
  const title = thisYearOnly ? formatWeekdayDate(day) : monthDayLabel(day);
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3"
      role="dialog"
      aria-modal="true"
      aria-label={`Map for ${title}`}
      data-testid="day-map-popup"
      style={{ backgroundColor: "rgba(12, 53, 84, 0.62)" }}
      onClick={onClose}
    >
      <div
        className="journal-card w-full max-w-lg overflow-hidden rounded-2xl shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative z-20 flex items-center justify-between gap-2 px-3 py-2">
          <div>
            <p className="font-display text-lg text-teal">{title}</p>
            <p className="text-[11px] text-ink-muted">
              {spots.length === 1 ? spots[0].placeName : `${spots.length} pins this date`}
            </p>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            className="relative z-20 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-paper text-lg leading-none"
            aria-label="Close map"
          >
            ×
          </button>
        </div>
        <SpotMap
          spots={spots}
          selectedKey={null}
          className="h-72 w-full overflow-hidden bg-paper-deep"
        />
        <div className="space-y-2 px-3 py-2">
          <PinSummary spots={spots} />
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full bg-teal py-2 text-sm font-semibold text-white"
          >
            See this day’s trips
          </button>
        </div>
      </div>
    </div>
  );
}

function PinSummary({ spots }: { spots: SpotGroup[] }) {
  if (!spots.length) return null;
  const line = spots
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
  return <p className="text-xs text-ink-muted">{line}</p>;
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
