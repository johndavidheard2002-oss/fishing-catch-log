"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SharedToggle, sharedQuery, useIncludeShared } from "./BuddyPanel";
import { CatchCard } from "./CatchCard";
import { baitTypesLabel } from "@/lib/bait";
import { CONDITION_LABELS } from "@/lib/labels";
import { formatCatchWhen } from "@/lib/time";
import { fishCountLabel } from "@/lib/count";
import type { BaitSpotGroup, SpotGroup } from "@/lib/types";

const SpotMap = dynamic(() => import("./SpotMap").then((m) => m.SpotMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-2xl border border-line bg-card text-sm text-ink-muted">
      Loading map…
    </div>
  ),
});

function baitGroupsToMapSpots(groups: BaitSpotGroup[]): SpotGroup[] {
  return groups.map((g) => ({
    key: g.key,
    placeName: g.placeName,
    latitude: g.latitude,
    longitude: g.longitude,
    catchCount: g.visitCount,
    fishCount: g.visitCount,
    species: g.baitTypes,
    speciesCounts: g.baitTypes.map((species) => ({
      species,
      count: g.spots.filter((s) => s.baitTypes.includes(species)).length,
    })),
    lastCaughtAt: g.lastLoggedAt,
    typicalCondition: g.typicalCondition,
    typicalTime: g.typicalTime,
    avgTempF: g.avgTempF,
    catches: [],
  }));
}

export function SpotsClient() {
  const params = useSearchParams();
  const kind = params.get("kind") === "bait" ? "bait" : "catch";
  const [spots, setSpots] = useState<SpotGroup[]>([]);
  const [baitGroups, setBaitGroups] = useState<BaitSpotGroup[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [includeShared, setIncludeShared] = useIncludeShared();
  const [viewerId, setViewerId] = useState<string | undefined>();
  const requestKey = `${kind}:${includeShared ? 1 : 0}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => setViewerId(data.me?.id));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const q = sharedQuery(includeShared);
    const url = kind === "bait" ? `/api/bait-spots${q ? `?${q}` : ""}` : `/api/spots${q ? `?${q}` : ""}`;
    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (kind === "bait") {
          const list = (data.groups ?? []) as BaitSpotGroup[];
          setBaitGroups(list);
          setSpots([]);
          setSelected(list[0]?.key ?? null);
        } else {
          const list = (data.spots ?? []) as SpotGroup[];
          setSpots(list);
          setBaitGroups([]);
          setSelected(list[0]?.key ?? null);
        }
        setLoadedKey(requestKey);
      })
      .catch(() => {
        if (!cancelled) setLoadedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [includeShared, kind, requestKey]);

  const onSelect = useCallback((key: string) => setSelected(key), []);
  const mapSpots = kind === "bait" ? baitGroupsToMapSpots(baitGroups) : spots;
  const currentCatch = spots.find((s) => s.key === selected) ?? spots[0];
  const currentBait = baitGroups.find((s) => s.key === selected) ?? baitGroups[0];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-teal">Spots</h1>
        <p className="text-sm text-ink-muted">
          {kind === "bait"
            ? "Where you get bait. Separate from catch pins so you can find shrimp and mullet under similar conditions."
            : "Grouped so you can go back under similar conditions. Same-day catches at different water stay as separate pins — moving one does not move the others."}
        </p>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-card p-1 text-sm font-semibold">
        <Link
          href="/spots"
          className={`rounded-xl py-2 text-center ${kind === "catch" ? "bg-teal text-white" : "text-ink-muted"}`}
        >
          Catch
        </Link>
        <Link
          href="/spots?kind=bait"
          className={`rounded-xl py-2 text-center ${kind === "bait" ? "bg-teal text-white" : "text-ink-muted"}`}
          data-testid="spots-bait-tab"
        >
          Bait
        </Link>
      </div>

      {kind === "bait" ? (
        <Link
          href="/bait/new"
          className="flex items-center justify-center rounded-2xl bg-copper px-4 py-3 font-semibold text-white"
          data-testid="log-bait-spot"
        >
          Log a bait spot
        </Link>
      ) : null}

      {loading ? (
        <p className="text-sm text-ink-muted">Loading spots…</p>
      ) : kind === "bait" && baitGroups.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No bait spots yet. Log where you throw the net or dip shrimp so Plan can match similar
          tides and weather.
        </p>
      ) : kind === "catch" && spots.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No spots yet. Log a catch to drop your first pin. Sample trips stay off until you load
          them from Home → More.
        </p>
      ) : (
        <>
          <SpotMap spots={mapSpots} selectedKey={selected} onSelect={onSelect} />
          {kind === "catch" ? (
            <>
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
                      <p className="text-xs text-ink-muted">Last {formatCatchWhen(spot.lastCaughtAt)}</p>
                    </button>
                  </li>
                ))}
              </ul>
              {currentCatch ? (
                <section className="space-y-2">
                  <h2 className="font-display text-xl text-teal">{currentCatch.placeName}</h2>
                  <p className="text-sm text-ink-muted">
                    {fishCountLabel(currentCatch.fishCount)} · {currentCatch.catchCount}{" "}
                    {currentCatch.catchCount === 1 ? "trip" : "trips"}
                    {currentCatch.speciesCounts?.length
                      ? ` · ${currentCatch.speciesCounts.map((row) => `${row.species} ${row.count}`).join(" · ")}`
                      : ""}
                    .
                  </p>
                  {currentCatch.typicalCondition || currentCatch.avgTempF != null ? (
                    <p className="text-sm text-ink-muted">
                      Revisit when the pattern matches
                      {currentCatch.typicalCondition
                        ? `: ${CONDITION_LABELS[currentCatch.typicalCondition]}`
                        : ""}
                      {currentCatch.avgTempF != null ? ` · ~${currentCatch.avgTempF}°F` : ""}.
                    </p>
                  ) : null}
                  {currentCatch.catches.map((record) => (
                    <CatchCard key={record.id} record={record} compact viewerId={viewerId} />
                  ))}
                  <Link href="/calendar" className="inline-block text-sm font-semibold text-teal">
                    Filter the full journal
                  </Link>
                </section>
              ) : null}
            </>
          ) : (
            <>
              <ul className="space-y-2">
                {baitGroups.map((spot) => (
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
                        {baitTypesLabel(spot.baitTypes)} · {spot.visitCount}{" "}
                        {spot.visitCount === 1 ? "visit" : "visits"}
                        {spot.avgTempF != null ? ` · ~${spot.avgTempF}°F` : ""}
                        {spot.typicalCondition
                          ? ` · ${CONDITION_LABELS[spot.typicalCondition]}`
                          : ""}
                      </p>
                      <p className="text-xs text-ink-muted">Last {formatCatchWhen(spot.lastLoggedAt)}</p>
                    </button>
                  </li>
                ))}
              </ul>
              {currentBait ? (
                <section className="space-y-2">
                  <h2 className="font-display text-xl text-teal">{currentBait.placeName}</h2>
                  <p className="text-sm text-ink-muted">
                    {baitTypesLabel(currentBait.baitTypes)} · {currentBait.visitCount}{" "}
                    {currentBait.visitCount === 1 ? "visit" : "visits"}
                    {currentBait.typicalCondition
                      ? ` · ${CONDITION_LABELS[currentBait.typicalCondition]}`
                      : ""}
                    {currentBait.avgTempF != null ? ` · ~${currentBait.avgTempF}°F` : ""}.
                  </p>
                  {currentBait.spots.map((spot) => (
                    <Link
                      key={spot.id}
                      href={`/bait/${spot.id}`}
                      className="journal-card block rounded-2xl px-3 py-3"
                    >
                      <p className="font-semibold">{baitTypesLabel(spot.baitTypes)}</p>
                      <p className="text-sm text-ink-muted">
                        {formatCatchWhen(spot.loggedAt)}
                        {spot.weatherCondition ? ` · ${CONDITION_LABELS[spot.weatherCondition]}` : ""}
                        {spot.tide ? ` · ${spot.tide} tide` : ""}
                      </p>
                    </Link>
                  ))}
                  <Link href="/plan" className="inline-block text-sm font-semibold text-teal">
                    See similar-condition windows on Plan
                  </Link>
                </section>
              ) : null}
            </>
          )}
        </>
      )}
      <SharedToggle includeShared={includeShared} onChange={setIncludeShared} />
    </div>
  );
}
