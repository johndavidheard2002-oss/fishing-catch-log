"use client";

import { CatchCard, CatchGridCard } from "@/components/CatchCard";
import { FilterPanel } from "@/components/FilterPanel";
import { HistoryCalendar } from "@/components/HistoryCalendar";
import { SharedToggle, sharedQuery, useIncludeShared } from "@/components/BuddyPanel";
import { localDateKey, parseYearMonth } from "@/lib/calendar";
import { hasActiveFilters, matchesFilters } from "@/lib/filters";
import type { CatchFilters, CatchRecord } from "@/lib/types";
import { scanQueueCount } from "@/lib/scan-queue";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type HistoryView = "grid" | "list" | "calendar";

export function HistoryClient() {
  const searchParams = useSearchParams();
  const [catches, setCatches] = useState<CatchRecord[]>([]);
  const [filters, setFilters] = useState<CatchFilters>(() => ({
    species: searchParams.get("species") || undefined,
  }));
  const [view, setView] = useState<HistoryView>(
    searchParams.get("view") === "calendar"
      ? "calendar"
      : searchParams.get("view") === "list"
        ? "list"
        : "grid",
  );
  const [showFilters, setShowFilters] = useState(Boolean(searchParams.get("species")));
  const [loading, setLoading] = useState(true);
  const [includeShared, setIncludeShared] = useIncludeShared();
  const [viewerId, setViewerId] = useState<string | undefined>();
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
    const q = sharedQuery(includeShared);
    fetch(`/api/catches${q ? `?${q}` : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setCatches(data.catches ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [includeShared]);

  const filtered = useMemo(
    () => catches.filter((c) => matchesFilters(c, filters)),
    [catches, filters],
  );
  const active = hasActiveFilters(filters);
  const latestDay = filtered[0] ? localDateKey(filtered[0].caughtAt) : null;
  const displayDay = selectedDay ?? (view === "calendar" ? latestDay : null);
  const monthCursor =
    monthOverride ??
    (displayDay
      ? parseYearMonth(displayDay)
      : { year: new Date().getFullYear(), month: new Date().getMonth() });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl text-teal">History</h1>
          <p className="text-sm text-ink-muted">
            {filtered.length} of {catches.length} catches
          </p>
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
        {(["grid", "list", "calendar"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`rounded-xl py-2 text-xs font-semibold capitalize ${
              view === id ? "bg-teal text-white" : "text-ink-muted"
            }`}
          >
            {id}
          </button>
        ))}
      </div>

      <SharedToggle includeShared={includeShared} onChange={setIncludeShared} />

      <LibraryScanBanner />

      {showFilters ? (
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          onClear={() => setFilters({})}
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
          label="Summer"
          onClick={() => {
            setFilters({ seasons: ["summer"] });
            setShowFilters(true);
          }}
        />
        <Preset
          label="Bass"
          onClick={() => {
            setFilters({ species: "Bass" });
            setShowFilters(true);
          }}
        />
        <Preset
          label="Freshwater"
          onClick={() => {
            setFilters({ habitats: ["freshwater"] });
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
          label="Full moon"
          onClick={() => {
            setFilters({ moonPhases: ["Full"] });
            setShowFilters(true);
          }}
        />
        <a
          href="/api/export"
          className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold"
        >
          Export CSV
        </a>
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">Loading the journal…</p>
      ) : view === "calendar" ? (
        <HistoryCalendar
          catches={filtered}
          year={monthCursor.year}
          month={monthCursor.month}
          selectedDay={displayDay}
          onMonthChange={setMonthOverride}
          onSelectDay={(day) => {
            setSelectedDay(day);
            setMonthOverride(parseYearMonth(day));
          }}
          viewerId={viewerId}
        />
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
