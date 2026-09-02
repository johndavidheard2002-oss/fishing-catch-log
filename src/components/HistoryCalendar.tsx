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
import type { CatchRecord } from "@/lib/types";
import Link from "next/link";
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
  const [thisYearOnly, setThisYearOnly] = useState(false);
  useEffect(() => {
    setThisYearOnly(false);
  }, [selectedDay]);
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
                  onClick={() => onSelectDay(cell.date)}
                  aria-label={`${cell.date}${count ? `, ${count} catches` : ""}${
                    otherYears ? ", other years on this date" : ""
                  }`}
                  aria-pressed={isSelected}
                  className="w-full leading-none"
                >
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
                </button>
                {count ? (
                  <DayThumbs
                    records={dayCatches}
                    selected={isSelected}
                    onOpenDay={() => onSelectDay(cell.date)}
                  />
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
              </div>
            );
          })}
        </div>
      </div>

      {selectedDay ? (
        <section className="space-y-2">
          <h2 className="font-display text-xl text-teal">
            {hasOtherYears && !thisYearOnly
              ? monthDayLabel(selectedDay)
              : formatWeekdayDate(selectedDay)}
          </h2>
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
                  onClick={() => setThisYearOnly(false)}
                  className={`rounded-full px-2.5 py-1 ${
                    !thisYearOnly ? "bg-teal text-white" : "text-ink-muted"
                  }`}
                >
                  All years
                </button>
                <button
                  type="button"
                  onClick={() => setThisYearOnly(true)}
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
          Tap a photo to open that catch, or tap the day number for the full list.
        </p>
      )}
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

function DayThumbs({
  records,
  selected,
  onOpenDay,
}: {
  records: CatchRecord[];
  selected: boolean;
  onOpenDay: () => void;
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
            <Link
              key={record.id}
              href={`/catch/${record.id}`}
              title={`${formatTimeOnly(record.caughtAt)} · ${speciesLabel(record.speciesList?.length ? record.speciesList : record.species)} · ${catchSpotLabel(record)}`}
              aria-label={`${speciesLabel(record.speciesList?.length ? record.speciesList : record.species)} at ${formatTimeOnly(record.caughtAt)}, ${catchSpotLabel(record)}`}
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
            </Link>
          );
        })}
        {extra > 0 ? (
          <button
            type="button"
            onClick={onOpenDay}
            className={`relative -ml-1 rounded-full px-1 text-[9px] font-bold ${
              selected ? "bg-white text-teal" : "bg-copper text-white"
            }`}
            aria-label={`${extra} more catches this day`}
          >
            +{extra}
          </button>
        ) : null}
      </span>
    </span>
  );
}
