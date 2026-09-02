"use client";

import { CatchCard, CatchGridCard } from "@/components/CatchCard";
import { FilterPanel } from "@/components/FilterPanel";
import { HistoryCalendar } from "@/components/HistoryCalendar";
import { SharedToggle, sharedQuery, useIncludeShared } from "@/components/BuddyPanel";
import { parseYearMonth } from "@/lib/calendar";
import { hasActiveFilters, matchesFilters } from "@/lib/filters";
import type { BaitSpot, CalendarNote, CalendarNoteInput, CatchFilters, CatchRecord } from "@/lib/types";
import { scanQueueCount } from "@/lib/scan-queue";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type LogView = "calendar" | "list" | "grid";

const VIEW_TABS: { id: LogView; label: string }[] = [
  { id: "calendar", label: "Calendar" },
  { id: "list", label: "List" },
  { id: "grid", label: "Grid" },
];

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
  const viewParam = searchParams.get("view");
  const view: LogView = viewParam === "list" || viewParam === "grid" ? viewParam : "calendar";
  const [showFilters, setShowFilters] = useState(Boolean(searchParams.get("species")));
  const [loading, setLoading] = useState(initialCatches === undefined);
  const [includeShared, setIncludeShared] = useIncludeShared();
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
    const q = sharedQuery(includeShared);
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
  }, [includeShared, shareEpoch]);

  useEffect(() => {
    let cancelled = false;
    const q = sharedQuery(includeShared);
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
  }, [includeShared, shareEpoch]);

  function clearFilters() {
    setFilters({});
    const next = new URLSearchParams();
    const view = searchParams.get("view");
    const day = searchParams.get("day");
    if (view === "list" || view === "grid") next.set("view", view);
    if (day) next.set("day", day);
    router.replace(logPath(next));
  }

  function changeView(id: LogView) {
    const next = new URLSearchParams(searchParams.toString());
    if (id === "calendar") next.delete("view");
    else next.set("view", id);
    router.replace(logPath(next));
  }

  const filtered = useMemo(
    () => catches.filter((c) => matchesFilters(c, filters)),
    [catches, filters],
  );
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

      <div className="journal-card grid grid-cols-3 overflow-hidden rounded-2xl p-1">
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => changeView(tab.id)}
            className={`rounded-xl py-2 text-xs font-semibold ${
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

      <div className="flex flex-wrap gap-2">
        <Preset
          label="Cloudy 70–80°F"
          onClick={() => {
            setFilters({ conditions: ["cloudy"], tempMin: 70, tempMax: 80 });
            setShowFilters(true);
          }}
        />
        <Preset
          label="Dawn"
          onClick={() => {
            setFilters({ timesOfDay: ["dawn"] });
            setShowFilters(true);
          }}
        />
        <Preset
          label="Redfish"
          onClick={() => {
            setFilters({ species: "Redfish" });
            setShowFilters(true);
          }}
        />
        <Preset
          label="Inshore"
          onClick={() => {
            setFilters({ habitats: ["saltwater-inshore"] });
            setShowFilters(true);
          }}
        />
        <Preset
          label="Offshore"
          onClick={() => {
            setFilters({ habitats: ["saltwater-offshore"] });
            setShowFilters(true);
          }}
        />
        <Preset
          label="Full moon"
          onClick={() => {
            setFilters({ moonPhases: ["Full"] });
            setShowFilters(true);
          }}
        />
      </div>

      {loadError ? <p className="text-sm text-copper">{loadError}</p> : null}

      {loading && catches.length === 0 ? (
        <p className="text-sm text-ink-muted">Loading the journal…</p>
      ) : view === "calendar" ? (
        <div className="space-y-3">
          {catches.length === 0 && baitSpots.length === 0 ? (
            <p className="text-sm text-ink-muted">
              Nothing logged yet. Tap a day to plan a trip with a note — no photo needed. Log a
              catch or bait later from Log or Log bait.
            </p>
          ) : filtered.length === 0 && baitSpots.length === 0 ? (
            <p className="text-sm text-ink-muted">
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
            onShareDay={async (day, shared) => {
              await fetch("/api/catches/share-day", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ day, shared }),
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
      ) : catches.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Nothing logged yet. Log a catch or backfill a photo — one picture becomes one trip at
          one pin. Sample trips are off unless you load them from Home → More.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Nothing matches those conditions. Clear filters or log another catch.
        </p>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((record) => (
            <CatchGridCard key={record.id} record={record} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((record) => (
            <CatchCard key={record.id} record={record} viewerId={viewerId} />
          ))}
        </div>
      )}

      <a
        href="/api/export"
        className="block pt-2 text-center text-sm font-semibold text-ink-muted"
      >
        Export CSV
      </a>
      <SharedToggle includeShared={includeShared} onChange={setIncludeShared} />
    </div>
  );
}

function LibraryScanBanner() {
  const [left] = useState(() => scanQueueCount());
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
        Continue reviewing. Nothing else is added until you tap Yes.
      </span>
    </Link>
  );
}

function Preset({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold"
    >
      {label}
    </button>
  );
}
