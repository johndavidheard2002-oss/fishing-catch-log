"use client";

import dynamic from "next/dynamic";
import { CatchCard } from "@/components/CatchCard";
import {
  catchSpotLabel,
  groupCatchesByDate,
  monthGrid,
  monthLabel,
  shiftMonth,
  todayKey,
  WEEKDAY_LABELS,
  uniqueSpotLabels,
} from "@/lib/calendar";
import { groupSpots } from "@/lib/filters";
import { photoSrc } from "@/lib/photo";
import { speciesLabel } from "@/lib/species";
import { formatTimeOnly, formatWeekdayDate, TIME_OF_DAY_LABELS } from "@/lib/time";
import { fishCountLabel } from "@/lib/count";
import type { CatchRecord } from "@/lib/types";
import Link from "next/link";

const SpotMap = dynamic(() => import("./SpotMap").then((m) => m.SpotMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-44 items-center justify-center rounded-2xl border border-line bg-card text-sm text-ink-muted">
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
  viewerId,
}: {
  catches: CatchRecord[];
  year: number;
  month: number;
  selectedDay: string | null;
  onMonthChange: (next: { year: number; month: number }) => void;
  onSelectDay: (date: string) => void;
  viewerId?: string;
}) {
  const byDate = groupCatchesByDate(catches);
  const cells = monthGrid(year, month);
  const today = todayKey();
  const selected = selectedDay ? (byDate.get(selectedDay) ?? []) : [];
  const selectedSpots = uniqueSpotLabels(selected);
  const selectedSpotGroups = groupSpots(selected);
  const mappedSpots = selectedSpotGroups.filter((s) => s.latitude != null && s.longitude != null);
  const monthCount = cells
    .filter((c) => c.inMonth)
    .reduce((n, c) => n + (byDate.get(c.date)?.length ?? 0), 0);

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
            <p className="text-xs text-ink-muted">
              {monthCount} {monthCount === 1 ? "catch" : "catches"} this month
            </p>
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
                  !isSelected && count > 0 ? "bg-paper-deep" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectDay(cell.date)}
                  aria-label={`${cell.date}${count ? `, ${count} catches` : ""}`}
                  aria-pressed={isSelected}
                  className="w-full leading-none"
                >
                  {cell.day}
                </button>
                <DayThumbs
                  records={dayCatches}
                  selected={isSelected}
                  onOpenDay={() => onSelectDay(cell.date)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {selectedDay ? (
        <section className="space-y-2">
          <h2 className="font-display text-xl text-teal">{formatWeekdayDate(selectedDay)}</h2>
          <p className="text-xs text-ink-muted">
            {selected.length} {selected.length === 1 ? "catch" : "catches"}
            {` · ${fishCountLabel(selected.reduce((n, c) => n + (c.fishCount || 1), 0))}`}
            {selectedSpots.length > 1
              ? ` · ${selectedSpots.length} spots`
              : selectedSpots[0]
                ? ` · ${selectedSpots[0]}`
                : ""}
            . Earliest first, each with its own pin.
          </p>
          {selectedSpots.length > 1 ? (
            <p className="text-xs text-ink-muted">{selectedSpots.join(" · ")}</p>
          ) : null}
          {mappedSpots.length > 1 ? (
            <SpotMap
              spots={selectedSpotGroups}
              selectedKey={null}
              onSelect={() => {}}
              className="h-44 w-full overflow-hidden rounded-2xl border border-line"
            />
          ) : null}
          {selected.length === 0 ? (
            <p className="text-sm text-ink-muted">No matching catches on this day.</p>
          ) : (
            selected.map((record, index) => {
              const prev = selected[index - 1];
              const showBucket = !prev || prev.timeOfDay !== record.timeOfDay;
              return (
                <div key={record.id} className="space-y-1.5">
                  {showBucket ? (
                    <p className="text-xs font-semibold text-ink-muted">
                      {TIME_OF_DAY_LABELS[record.timeOfDay]}
                    </p>
                  ) : null}
                  <CatchCard record={record} compact showTime viewerId={viewerId} />
                </div>
              );
            })
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
