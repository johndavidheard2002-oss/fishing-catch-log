"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SharedToggle, sharedQuery, useIncludeShared } from "./BuddyPanel";
import { CatchCard } from "./CatchCard";
import { CONDITION_LABELS } from "@/lib/labels";
import { formatDateOnly } from "@/lib/time";
import { fishCountLabel } from "@/lib/count";
import type { SpotGroup } from "@/lib/types";

const SpotMap = dynamic(() => import("./SpotMap").then((m) => m.SpotMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-2xl border border-line bg-card text-sm text-ink-muted">
      Loading map…
    </div>
  ),
});

export function SpotsClient() {
  const [spots, setSpots] = useState<SpotGroup[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [includeShared, setIncludeShared] = useIncludeShared();
  const [viewerId, setViewerId] = useState<string | undefined>();

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => setViewerId(data.me?.id));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const q = sharedQuery(includeShared);
    fetch(`/api/spots${q ? `?${q}` : ""}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = (data.spots ?? []) as SpotGroup[];
        setSpots(list);
        setSelected(list[0]?.key ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [includeShared]);

  const onSelect = useCallback((key: string) => setSelected(key), []);
  const current = spots.find((s) => s.key === selected) ?? spots[0];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-teal">Spots</h1>
        <p className="text-sm text-ink-muted">
          Grouped so you can go back under similar conditions. Same-day catches at different water
          stay as separate pins — moving one does not move the others.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">Loading spots…</p>
      ) : spots.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No spots yet. Log a catch to drop your first pin. Sample lakes stay off until you load
          them from Home → More.
        </p>
      ) : (
        <>
          <SpotMap spots={spots} selectedKey={selected} onSelect={onSelect} />
          <ul className="space-y-2">
            {spots.map((spot) => (
              <li key={spot.key}>
                <button
                  type="button"
                  onClick={() => setSelected(spot.key)}
                  className={`journal-card w-full rounded-2xl px-3 py-3 text-left ${
                    spot.key === selected ? "ring-2 ring-copper" : ""
                  }`}
                >
                  <p className="font-semibold">{spot.placeName}</p>
                  <p className="text-sm text-ink-muted">
                    {fishCountLabel(spot.fishCount)} · {spot.catchCount}{" "}
                    {spot.catchCount === 1 ? "trip" : "trips"} ·{" "}
                    {spot.species.slice(0, 3).join(", ")}
                    {spot.avgTempF != null ? ` · ~${spot.avgTempF}°F` : ""}
                    {spot.typicalCondition
                      ? ` · ${CONDITION_LABELS[spot.typicalCondition]}`
                      : ""}
                  </p>
                  <p className="text-xs text-ink-muted">
                    Last {formatDateOnly(spot.lastCaughtAt)}
                    {spot.typicalSeason ? ` · ${spot.typicalSeason}` : ""}
                    {spot.typicalTime ? ` · ${spot.typicalTime}` : ""}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          {current ? (
            <section className="space-y-2">
              <h2 className="font-display text-xl text-teal">{current.placeName}</h2>
              <p className="text-sm text-ink-muted">
                {fishCountLabel(current.fishCount)} · {current.catchCount}{" "}
                {current.catchCount === 1 ? "trip" : "trips"}
                {current.speciesCounts?.length
                  ? ` · ${current.speciesCounts.map((row) => `${row.species} ${row.count}`).join(" · ")}`
                  : ""}
                .
              </p>
              <p className="text-sm text-ink-muted">
                Revisit when the pattern matches: {current.typicalSeason},{" "}
                {current.typicalTime}
                {current.typicalCondition
                  ? `, ${CONDITION_LABELS[current.typicalCondition]}`
                  : ""}
                .
              </p>
              {current.catches.map((record) => (
                <CatchCard key={record.id} record={record} compact viewerId={viewerId} />
              ))}
              <Link href="/history" className="inline-block text-sm font-semibold text-teal">
                Filter the full journal
              </Link>
            </section>
          ) : null}
        </>
      )}
      <SharedToggle includeShared={includeShared} onChange={setIncludeShared} />
    </div>
  );
}
