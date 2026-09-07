"use client";

import { CatchCard, CatchGridCard } from "@/components/CatchCard";
import { BaitSpotCard, BaitSpotGridCard } from "@/components/BaitSpotCard";
import { FilterPanel } from "@/components/FilterPanel";
import { HistoryCalendar } from "@/components/HistoryCalendar";
import { sharedQuery } from "@/components/BuddyPanel";
import {
  CALENDAR_LOG_VIEW_TABS,
  DEFAULT_CALENDAR_LOG_VIEW,
  friendSharedRecords,
  ownJournalRecords,
  parseYearMonth,
  resolveCalendarLogView,
  type CalendarLogView,
} from "@/lib/calendar";
import { hasActiveFilters, matchesFilters } from "@/lib/filters";
import { mergeJournalFeed, type JournalFeedItem } from "@/lib/journal";
import type { BaitSpot, CalendarNote, CalendarNoteInput, CatchFilters, CatchRecord } from "@/lib/types";
import {
  getScanQueueCountServerSnapshot,
  scanQueueCount,
  subscribeScanQueue,
} from "@/lib/scan-queue";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

function logPath(params: URLSearchParams): string {
  const qs = params.toString();
  return qs ? `/calendar?${qs}` : "/calendar";
}

export function HistoryClient({
  initialCatches,
  initialBaitSpots,
  initialNotes,
  initialViewerId,
}: {
  initialCatches?: CatchRecord[];
  initialBaitSpots?: BaitSpot[];
  initialNotes?: CalendarNote[];
  initialViewerId?: string;
} = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [catches, setCatches] = useState<CatchRecord[]>(initialCatches ?? []);
  const [baitSpots, setBaitSpots] = useState<BaitSpot[]>(initialBaitSpots ?? []);
  const [notes, setNotes] = useState<CalendarNote[]>(initialNotes ?? []);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CatchFilters>(() => ({
    species: searchParams.get("species") || undefined,
  }));
  const view = resolveCalendarLogView(searchParams.get("view"));
  const [showFilters, setShowFilters] = useState(Boolean(searchParams.get("species")));
  const [loading, setLoading] = useState(initialCatches === undefined);
  const [viewerId, setViewerId] = useState<string | undefined>(initialViewerId);
  const [shareEpoch, setShareEpoch] = useState(0);
  const queryDay = searchParams.get("day");
  const [monthOverride, setMonthOverride] = useState<{ year: number; month: number } | null>(
    queryDay ? parseYearMonth(queryDay) : null,
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(queryDay);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => setViewerId(data.me?.id));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/calendar-notes", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.notes)) setNotes(data.notes);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const q = sharedQuery(true);
    fetch(`/api/catches${q ? `?${q}` : ""}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("bad status");
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data.catches)) setCatches(data.catches);
        setLoadError(null);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not open the journal. Try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shareEpoch]);

  useEffect(() => {
    let cancelled = false;
    const q = sharedQuery(true);
    fetch(`/api/bait-spots${q ? `?${q}` : ""}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("bad status");
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data.spots)) setBaitSpots(data.spots);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [shareEpoch]);

  function clearFilters() {
    setFilters({});
    const next = new URLSearchParams();
    const view = searchParams.get("view");
    const day = searchParams.get("day");
    const resolved = resolveCalendarLogView(view);
    if (view && resolved !== DEFAULT_CALENDAR_LOG_VIEW) next.set("view", resolved);
    if (day) next.set("day", day);
    router.replace(logPath(next));
  }

  function changeView(id: CalendarLogView) {
    const next = new URLSearchParams(searchParams.toString());
    if (id === DEFAULT_CALENDAR_LOG_VIEW) next.delete("view");
    else next.set("view", id);
    router.replace(logPath(next));
  }

  const filtered = useMemo(
    () => catches.filter((c) => matchesFilters(c, filters)),
    [catches, filters],
  );
  const ownCatches = useMemo(() => ownJournalRecords(filtered, viewerId), [filtered, viewerId]);
  const ownBait = useMemo(() => ownJournalRecords(baitSpots, viewerId), [baitSpots, viewerId]);
  const sharedCatches = useMemo(
    () => friendSharedRecords(filtered, viewerId),
    [filtered, viewerId],
  );
  const sharedBait = useMemo(
    () => friendSharedRecords(baitSpots, viewerId),
    [baitSpots, viewerId],
  );
  const ownFeed = useMemo(() => mergeJournalFeed(ownCatches, ownBait), [ownCatches, ownBait]);
  const sharedFeed = useMemo(
    () => mergeJournalFeed(sharedCatches, sharedBait),
    [sharedCatches, sharedBait],
  );
  const journalEmpty = catches.length === 0 && baitSpots.length === 0;
  const ownEmpty = ownCatches.length === 0 && ownBait.length === 0;
  const sharedEmpty = sharedCatches.length === 0 && sharedBait.length === 0;
  const active = hasActiveFilters(filters);
  const displayDay = selectedDay;
  const monthCursor =
    monthOverride ??
    (queryDay
      ? parseYearMonth(queryDay)
      : { year: new Date().getFullYear(), month: new Date().getMonth() });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="page-intro flex-1">
          <h1 className="font-display text-3xl text-teal">Calendar Log</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            active || showFilters ? "bg-teal text-white" : "border border-line bg-card"
          }`}
        >
          Filters
        </button>
      </div>

      <div
        className="journal-card grid grid-cols-4 overflow-hidden rounded-2xl p-1"
        data-testid="calendar-log-tabs"
      >
        {CALENDAR_LOG_VIEW_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => changeView(tab.id)}
            data-testid={`calendar-log-tab-${tab.id}`}
            className={`rounded-xl px-0.5 py-2 text-[11px] font-semibold ${
              view === tab.id ? "bg-teal text-white" : "text-ink-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <LibraryScanBanner />

      {showFilters ? (
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          onClear={clearFilters}
        />
      ) : null}

      {loadError ? <p className="on-wash-chip text-sm text-copper">{loadError}</p> : null}

      {loading && journalEmpty ? (
        <p className="on-wash-chip text-sm">Loading the journal…</p>
      ) : view === "calendar" ? (
        <div className="space-y-3">
          {journalEmpty ? (
            <p className="on-wash-chip text-sm">
              Nothing logged yet. Tap a day to plan a trip with a note — no photo needed. Log a
              catch or bait later from Log or Log bait.
            </p>
          ) : filtered.length === 0 && baitSpots.length === 0 ? (
            <p className="on-wash-chip text-sm">
              Nothing matches those conditions. Clear filters or log another catch.
            </p>
          ) : null}
          <HistoryCalendar
            catches={filtered}
            baitSpots={baitSpots}
            notes={notes}
            year={monthCursor.year}
            month={monthCursor.month}
            selectedDay={displayDay}
            onMonthChange={setMonthOverride}
            onSelectDay={(day) => {
              setSelectedDay(day);
              setMonthOverride(parseYearMonth(day));
            }}
            onShareDay={async (day, shared, buddyIds) => {
              await fetch("/api/share", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ day, shared, buddyIds }),
              });
              setShareEpoch((n) => n + 1);
            }}
            onShareSpots={async ({ catchIds, baitSpotIds, shared, buddyIds }) => {
              await fetch("/api/share", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ catchIds, baitSpotIds, shared, buddyIds }),
              });
              setShareEpoch((n) => n + 1);
            }}
            onCreateNote={async (input: CalendarNoteInput) => {
              const res = await fetch("/api/calendar-notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input),
              });
              if (!res.ok) throw new Error("save failed");
              const data = await res.json();
              if (data.note) setNotes((current) => [...current, data.note]);
            }}
            onUpdateNote={async (id, input) => {
              const res = await fetch(`/api/calendar-notes/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input),
              });
              if (!res.ok) throw new Error("save failed");
              const data = await res.json();
              if (data.note) {
                setNotes((current) => current.map((n) => (n.id === id ? data.note : n)));
              }
            }}
            onDeleteNote={async (id) => {
              const res = await fetch(`/api/calendar-notes/${id}`, { method: "DELETE" });
              if (!res.ok) throw new Error("delete failed");
              setNotes((current) => current.filter((n) => n.id !== id));
            }}
            viewerId={viewerId}
          />
        </div>
      ) : view === "shared" ? (
        sharedEmpty && !active ? (
          <p className="on-wash-chip text-sm">
            Nothing shared with you yet. When a linked friend shares a spot, it shows up here.
          </p>
        ) : sharedFeed.length === 0 ? (
          <p className="on-wash-chip text-sm">
            Nothing matches those conditions. Clear filters or wait for another shared spot.
          </p>
        ) : (
          <JournalCards
            feed={sharedFeed}
            viewerId={viewerId}
            layout="list"
            testId="calendar-log-shared-feed"
          />
        )
      ) : ownEmpty && !active ? (
        <p className="on-wash-chip text-sm">
          Nothing logged yet. Log a catch or backfill a photo — one picture becomes one trip at
          one pin.
        </p>
      ) : ownFeed.length === 0 ? (
        <p className="on-wash-chip text-sm">
          Nothing matches those conditions. Clear filters or log another catch.
        </p>
      ) : (
        <JournalCards
          feed={ownFeed}
          viewerId={viewerId}
          layout={view === "grid" ? "grid" : "list"}
          testId="calendar-log-own-feed"
        />
      )}

      <a
        href="/api/export"
        className="on-wash-chip mx-auto mt-2 block w-fit text-center text-sm font-semibold"
      >
        Export CSV
      </a>
    </div>
  );
}

function JournalCards({
  feed,
  viewerId,
  layout,
  testId,
}: {
  feed: JournalFeedItem[];
  viewerId?: string;
  layout: "list" | "grid";
  testId?: string;
}) {
  if (layout === "grid") {
    return (
      <div className="grid grid-cols-2 gap-3" data-testid={testId}>
        {feed.map((item) =>
          item.kind === "catch" ? (
            <CatchGridCard key={item.id} record={item.record} viewerId={viewerId} />
          ) : (
            <BaitSpotGridCard key={item.id} spot={item.spot} viewerId={viewerId} />
          ),
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3" data-testid={testId}>
      {feed.map((item) =>
        item.kind === "catch" ? (
          <CatchCard key={item.id} record={item.record} viewerId={viewerId} />
        ) : (
          <BaitSpotCard key={item.id} spot={item.spot} viewerId={viewerId} />
        ),
      )}
    </div>
  );
}

function LibraryScanBanner() {
  const left = useSyncExternalStore(
    subscribeScanQueue,
    scanQueueCount,
    getScanQueueCountServerSnapshot,
  );
  if (!left) return null;
  return (
    <Link
      href="/log/scan"
      className="block rounded-2xl border border-line bg-card px-3 py-3 text-sm"
    >
      <span className="font-semibold text-teal">
        {left} more fishing photo{left === 1 ? "" : "s"} from your library
      </span>
      <span className="mt-0.5 block text-xs text-ink-muted">
        Continue reviewing. Nothing is added until you finish the trip form.
      </span>
    </Link>
  );
}
