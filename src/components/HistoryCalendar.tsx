"use client";

import { CatchCard } from "@/components/CatchCard";
import {
  groupCatchesByDate,
  monthGrid,
  monthLabel,
  shiftMonth,
  todayKey,
  WEEKDAY_LABELS,
} from "@/lib/calendar";
import { photoSrc } from "@/lib/photo";
import { formatTimeOnly, formatWeekdayDate } from "@/lib/time";
import type { CatchRecord } from "@/lib/types";

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
              <button
                key={cell.date}
                type="button"
                onClick={() => onSelectDay(cell.date)}
                aria-label={`${cell.date}${count ? `, ${count} catches` : ""}`}
                aria-pressed={isSelected}
                className={`flex min-h-[4.25rem] flex-col items-center rounded-xl px-0.5 py-1 text-xs ${
                  isSelected
                    ? "bg-teal font-semibold text-white"
                    : isToday
                      ? "ring-1 ring-copper"
                      : ""
                } ${cell.inMonth ? "" : "opacity-35"} ${
                  !isSelected && count > 0 ? "bg-paper-deep" : ""
                }`}
              >
                <span className="leading-none">{cell.day}</span>
                <DayThumbs records={dayCatches} selected={isSelected} />
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay ? (
        <section className="space-y-2">
          <h2 className="font-display text-xl text-teal">{formatWeekdayDate(selectedDay)}</h2>
          <p className="text-xs text-ink-muted">In the order you caught them.</p>
          {selected.length === 0 ? (
            <p className="text-sm text-ink-muted">No matching catches on this day.</p>
          ) : (
            selected.map((record) => (
              <CatchCard
                key={record.id}
                record={record}
                compact
                showTime
                viewerId={viewerId}
              />
            ))
          )}
        </section>
      ) : (
        <p className="text-sm text-ink-muted">Tap a day or a photo to see that trip.</p>
      )}
    </div>
  );
}

function DayThumbs({ records, selected }: { records: CatchRecord[]; selected: boolean }) {
  if (!records.length) return <span className="mt-1 h-6" />;
  const shown = records.slice(0, 3);
  const extra = records.length - shown.length;
  return (
    <span className="relative mt-1 flex h-6 w-full items-center justify-center">
      <span className="flex items-center">
        {shown.map((record, i) => {
          const src = photoSrc(record.photoPath);
          return (
            <span
              key={record.id}
              title={`${formatTimeOnly(record.caughtAt)} · ${record.species}`}
              className={`relative h-6 w-6 overflow-hidden rounded-md border ${
                selected ? "border-white/70" : "border-white"
              } bg-paper`}
              style={{ marginLeft: i === 0 ? 0 : -8, zIndex: shown.length - i }}
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

