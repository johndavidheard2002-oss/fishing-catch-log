"use client";

import { CatchCard, CatchGridCard } from "@/components/CatchCard";
import { FilterPanel } from "@/components/FilterPanel";
import { hasActiveFilters, matchesFilters } from "@/lib/filters";
import type { CatchFilters, CatchRecord } from "@/lib/types";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export function HistoryClient() {
  const searchParams = useSearchParams();
  const [catches, setCatches] = useState<CatchRecord[]>([]);
  const [filters, setFilters] = useState<CatchFilters>(() => ({
    species: searchParams.get("species") || undefined,
  }));
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(Boolean(searchParams.get("species")));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/catches")
      .then((r) => r.json())
      .then((data) => setCatches(data.catches ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => catches.filter((c) => matchesFilters(c, filters)),
    [catches, filters],
  );
  const active = hasActiveFilters(filters);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl text-teal">History</h1>
          <p className="text-sm text-ink-muted">
            {filtered.length} of {catches.length} catches
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView(view === "grid" ? "list" : "grid")}
            className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold"
          >
            {view === "grid" ? "List" : "Grid"}
          </button>
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
      </div>

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
        <a
          href="/api/export"
          className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold"
        >
          Export CSV
        </a>
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">Loading the journal…</p>
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
            <CatchCard key={record.id} record={record} />
          ))}
        </div>
      )}
    </div>
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
