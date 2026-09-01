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
import { formatWeekdayDate } from "@/lib/time";
import type { CatchRecord } from "@/lib/types";

export function HistoryCalendar({
  catches,
  year,
  month,
  selectedDay,
  onMonthChange,
  onSelectDay,
}: {
  catches: CatchRecord[];
  year: number;
  month: number;
  selectedDay: string | null;
  onMonthChange: (next: { year: number; month: number }) => void;
  onSelectDay: (date: string) => void;
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
            const count = byDate.get(cell.date)?.length ?? 0;
            const isSelected = selectedDay === cell.date;
            const isToday = cell.date === today;
            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => onSelectDay(cell.date)}
                aria-label={`${cell.date}${count ? `, ${count} catches` : ""}`}
                aria-pressed={isSelected}
                className={`flex min-h-11 flex-col items-center justify-center rounded-xl py-1 text-sm ${
                  isSelected
                    ? "bg-teal font-semibold text-white"
                    : isToday
                      ? "ring-1 ring-copper"
                      : ""
                } ${cell.inMonth ? "" : "opacity-35"} ${
                  !isSelected && count > 0 ? "bg-paper-deep font-semibold" : ""
                }`}
              >
                {cell.day}
                <span className="mt-0.5 flex h-2 items-center justify-center gap-0.5">
                  {count > 0
                    ? Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                        <span
                          key={i}
                          className={`h-1.5 w-1.5 rounded-full ${
                            isSelected ? "bg-white" : "bg-copper"
                          }`}
                        />
                      ))
                    : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay ? (
        <section className="space-y-2">
          <h2 className="font-display text-xl text-teal">{formatWeekdayDate(selectedDay)}</h2>
          {selected.length === 0 ? (
            <p className="text-sm text-ink-muted">No matching catches on this day.</p>
          ) : (
            selected.map((record) => <CatchCard key={record.id} record={record} compact />)
          )}
        </section>
      ) : (
        <p className="text-sm text-ink-muted">Tap a day to see what you caught.</p>
      )}
    </div>
  );
}
