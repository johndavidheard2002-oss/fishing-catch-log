"use client";

import dynamic from "next/dynamic";
import { CatchCard } from "@/components/CatchCard";
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
  uniqueSpotLabels,
  yearFromDateKey,
} from "@/lib/calendar";
import { groupSpots } from "@/lib/filters";
import { photoSrc } from "@/lib/photo";
import { speciesLabel } from "@/lib/species";
import { formatTimeOnly, formatWeekdayDate } from "@/lib/time";
import { fishCountLabel } from "@/lib/count";
import type { CatchRecord, SpotGroup } from "@/lib/types";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

const SpotMap = dynamic(() => import("./SpotMap").then((m) => m.SpotMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 items-center justify-center rounded-2xl border border-line bg-card text-sm text-ink-muted">
      Loading map…
    </div>
  ),
});

export function HistoryCalendar({
  catches,
  year,
  month,
  selectedDay,
  onMonthChange,
  onSelectDay,
  onShareDay,
  viewerId,
}: {
  catches: CatchRecord[];
  year: number;
  month: number;
  selectedDay: string | null;
  onMonthChange: (next: { year: number; month: number }) => void;
  onSelectDay: (date: string) => void;
  onShareDay?: (day: string, shared: boolean) => void | Promise<void>;
  viewerId?: string;
}) {
  const [thisYearOnlyDay, setThisYearOnlyDay] = useState<string | null>(null);
  const [mapDay, setMapDay] = useState<string | null>(null);
  const thisYearOnly = Boolean(selectedDay && thisYearOnlyDay === selectedDay);
  const byDate = groupCatchesByDate(catches);
  const cells = monthGrid(year, month);
  const today = todayKey();
  const thisYearSelected = selectedDay ? (byDate.get(selectedDay) ?? []) : [];
  const acrossYears = selectedDay ? catchesOnMonthDay(catches, selectedDay) : [];
  const yearGroupsAll = groupCatchesByYear(acrossYears);
  const hasOtherYears = yearGroupsAll.length > 1 || (thisYearSelected.length === 0 && acrossYears.length > 0);
  const selected = thisYearOnly ? thisYearSelected : acrossYears;
  const yearGroups = groupCatchesByYear(selected);
  const selectedSpots = uniqueSpotLabels(selected);
  const selectedSpotGroups = groupSpots(selected);
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
                  !isSelected && (count > 0 || otherYears) ? "bg-paper-deep" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => openDay(cell.date)}
                  aria-label={`${cell.date}${count ? `, ${count} catches` : ""}${
                    otherYears ? ", other years on this date" : ""
                  }`}
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
                    <DayThumbs records={dayCatches} selected={isSelected} />
                  ) : otherYears ? (
                    <span
                      className={`mt-1 rounded-full px-1 text-[9px] font-bold ${
                        isSelected ? "bg-white text-teal" : "bg-copper text-white"
                      }`}
                    >
                      {groupCatchesByYear(anniversary).length}y
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
        <section className="space-y-2">
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
                className="rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-teal"
              >
                {popupOpen ? "Map open" : "Open map"}
              </button>
            ) : null}
          </div>
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
          {selected.length === 0 ? null : mappedSpots.length ? (
            <SpotMap
              spots={mappedSpots}
              selectedKey={null}
              className="h-56 w-full overflow-hidden rounded-2xl border border-line"
            />
          ) : (
            <p className="rounded-2xl border border-line bg-card px-3 py-3 text-sm text-ink-muted">
              {thisYearOnly || !hasOtherYears
                ? "No map pins this day — those trips have no saved location."
                : "No map pins on this date — those trips have no saved location."}
            </p>
          )}
          {selectedSpots.length > 1 ? (
            <p className="text-xs text-ink-muted">
              {selectedSpotGroups
                .slice()
                .sort((a, b) => {
                  const aFirst =
                    [...a.catches].sort((x, y) => x.caughtAt.localeCompare(y.caughtAt))[0]
                      ?.caughtAt ?? "";
                  const bFirst =
                    [...b.catches].sort((x, y) => x.caughtAt.localeCompare(y.caughtAt))[0]
                      ?.caughtAt ?? "";
                  return aFirst.localeCompare(bFirst);
                })
                .map((spot) => `${spot.placeName} · ${fishCountLabel(spot.fishCount)}`)
                .join(" · ")}
            </p>
          ) : selectedSpots[0] ? (
            <p className="text-xs text-ink-muted">{selectedSpots[0]}</p>
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
                : "No matching catches on this day."}
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
          Tap a day to open its map and trips. Open a catch from the list under the calendar.
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
  if (typeof document === "undefined") return null;
  const title = thisYearOnly ? formatWeekdayDate(day) : monthDayLabel(day);
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Map for ${title}`}
      onClick={onClose}
    >
      <div
        className="journal-card w-full max-w-lg overflow-hidden rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div>
            <p className="font-display text-lg text-teal">{title}</p>
            <p className="text-[11px] text-ink-muted">
              {spots.length === 1 ? spots[0].placeName : `${spots.length} pins this date`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-paper text-lg leading-none"
            aria-label="Close map"
          >
            ×
          </button>
        </div>
        <SpotMap
          spots={spots}
          selectedKey={null}
          className="h-[min(65dvh,28rem)] w-full overflow-hidden"
        />
      </div>
    </div>,
    document.body,
  );
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
