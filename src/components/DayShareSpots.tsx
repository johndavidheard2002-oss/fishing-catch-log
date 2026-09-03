"use client";

import { useState } from "react";
import { dayShareSpots, type DayShareSpot } from "@/lib/sharing";
import type { BaitSpot, CatchRecord } from "@/lib/types";

export function DayShareSpots({
  day,
  catches,
  baitSpots,
  viewerId,
  onShareSpots,
  onShareDay,
}: {
  day: string;
  catches: CatchRecord[];
  baitSpots: BaitSpot[];
  viewerId?: string;
  onShareSpots: (args: {
    catchIds: string[];
    baitSpotIds: string[];
    shared: boolean;
  }) => void | Promise<void>;
  onShareDay: (day: string, shared: boolean) => void | Promise<void>;
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  if (!viewerId) return null;
  const rows = dayShareSpots({ catches, baitSpots, viewerId });
  if (!rows.length) return null;
  const allShared = rows.every((row) => row.shared);

  async function toggle(row: DayShareSpot, shared: boolean) {
    setBusyKey(row.key);
    try {
      await onShareSpots({
        catchIds: row.catchIds,
        baitSpotIds: row.baitSpotIds,
        shared,
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleDay(shared: boolean) {
    setBusyKey("day");
    try {
      await onShareDay(day, shared);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="space-y-2 rounded-2xl border border-line bg-card px-3 py-3" data-testid="select-spots-to-share">
      <div>
        <p className="text-sm font-semibold">Select spots to share</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Linked buddies can see these spots. Off until you choose.
        </p>
      </div>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.key}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={row.shared}
                disabled={busyKey !== null}
                data-testid={`share-spot-${row.kind}`}
                onChange={(e) => void toggle(row, e.target.checked)}
                className="mt-0.5"
              />
              {row.thumbSrc ? (
                <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-paper-deep">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.thumbSrc} alt="" className="h-full w-full object-cover" />
                </span>
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-paper-deep text-[9px] leading-tight text-ink-muted">
                  {row.kind === "bait" ? "Bait" : "Spot"}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{row.placeName}</span>
                <span className="block truncate text-xs text-ink-muted">{row.summary}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
        <button
          type="button"
          disabled={busyKey !== null || allShared}
          data-testid="share-all-spots"
          onClick={() => void toggleDay(true)}
          className="text-xs font-semibold text-teal disabled:opacity-40"
        >
          Share all spots on this day
        </button>
        <button
          type="button"
          disabled={busyKey !== null || rows.every((row) => !row.shared)}
          data-testid="unshare-all-spots"
          onClick={() => void toggleDay(false)}
          className="text-xs font-semibold text-ink-muted disabled:opacity-40"
        >
          Unshare all
        </button>
      </div>
    </section>
  );
}
