"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { OptionThumb } from "./OptionThumb";
import { SharedToggle, sharedQuery, useIncludeShared } from "./BuddyPanel";
import { baitTypesLabel } from "@/lib/bait";
import { CONDITION_LABELS } from "@/lib/labels";
import { formatCoords } from "@/lib/location";
import { formatCatchWhen, TIME_OF_DAY_LABELS } from "@/lib/time";
import { fishCountLabel } from "@/lib/count";
import {
  baitGroupThumbSrc,
  baitRecordThumbSrc,
  catchGroupThumbSrc,
  catchRecordThumbSrc,
} from "@/lib/spot-thumbs";
import {
  LocationMapSheet,
  targetFromBait,
  targetFromBaitGroup,
  targetFromCatch,
  targetFromSpotGroup,
  type LocationMapTarget,
} from "@/components/LocationMapSheet";
import type { BaitSpot, BaitSpotGroup, CatchRecord, SpotGroup } from "@/lib/types";

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
  const [mapFollowsSelection, setMapFollowsSelection] = useState(false);
  const [mapTarget, setMapTarget] = useState<LocationMapTarget | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [includeShared, setIncludeShared] = useIncludeShared();
  const [viewerId, setViewerId] = useState<string | undefined>();
  const detailRef = useRef<HTMLDivElement>(null);
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
          setMapFollowsSelection(false);
        } else {
          const list = (data.spots ?? []) as SpotGroup[];
          setSpots(list);
          setBaitGroups([]);
          setSelected(list[0]?.key ?? null);
          setMapFollowsSelection(false);
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

  const onSelect = useCallback(
    (key: string, openSheet = true) => {
      setSelected(key);
      setMapFollowsSelection(true);
      if (openSheet) {
        if (kind === "bait") {
          const group = baitGroups.find((item) => item.key === key);
          setMapTarget(group ? targetFromBaitGroup(group) : null);
        } else {
          const spot = spots.find((item) => item.key === key);
          setMapTarget(spot ? targetFromSpotGroup(spot) : null);
        }
      }
      requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    },
    [baitGroups, kind, spots],
  );
  const mapSpots = kind === "bait" ? baitGroupsToMapSpots(baitGroups) : spots;
  const currentCatch = spots.find((s) => s.key === selected) ?? null;
  const currentBait = baitGroups.find((s) => s.key === selected) ?? null;

  return (
    <div className="space-y-4">
      <div className="page-intro">
        <h1 className="font-display text-3xl text-teal">Spots</h1>
        <p className="text-sm text-ink-muted">
          {kind === "bait"
            ? "Bait holes — shrimp, mullet, crabs — separate from where you land fish."
            : "Catch pins grouped so you can go back under similar conditions. Same-day catches at different water stay as separate pins."}
        </p>
      </div>

      <div className="journal-card grid grid-cols-2 overflow-hidden rounded-2xl p-1 text-sm font-semibold">
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

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/log"
          className="flex items-center justify-center rounded-2xl bg-copper px-4 py-3 font-semibold text-white"
        >
          Log a catch
        </Link>
        <Link
          href="/bait/new"
          className="flex items-center justify-center rounded-2xl bg-teal px-4 py-3 font-semibold text-white"
          data-testid="log-bait-spot"
        >
          Log bait
        </Link>
      </div>

      {loading ? (
        <p className="on-wash-chip text-sm">Loading spots…</p>
      ) : kind === "bait" && baitGroups.length === 0 ? (
        <>
          <SpotMap spots={[]} selectedKey={null} overview />
          <p className="on-wash-chip text-sm">
            No bait yet. Tap Log bait, pin the hole, and tag shrimp, mullet, or crabs so Plan can
            match similar tides and weather.
          </p>
        </>
      ) : kind === "catch" && spots.length === 0 ? (
        <>
          <SpotMap spots={[]} selectedKey={null} overview />
          <p className="on-wash-chip text-sm">
            No spots yet. Log a catch to drop your first pin. Sample trips stay off until you load
            them from Home → More.
          </p>
        </>
      ) : (
        <>
          <SpotMap
            spots={mapSpots}
            selectedKey={selected}
            onSelect={onSelect}
            overview
            followSelection={mapFollowsSelection}
          />
          <div ref={detailRef}>
            {kind === "catch" && currentCatch ? (
              <CatchSpotPanel
                spot={currentCatch}
                viewerId={viewerId}
                onOpenLocation={setMapTarget}
              />
            ) : null}
            {kind === "bait" && currentBait ? (
              <BaitSpotPanel
                group={currentBait}
                viewerId={viewerId}
                onOpenLocation={setMapTarget}
              />
            ) : null}
          </div>
          {kind === "catch" ? (
            <ul className="space-y-2">
              {spots.map((spot) => (
                <li key={spot.key}>
                  <button
                    type="button"
                    onClick={() => onSelect(spot.key)}
                    className={`journal-card flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${
                      spot.key === selected ? "ring-2 ring-copper" : ""
                    }`}
                  >
                    <OptionThumb src={catchGroupThumbSrc(spot)} kind="catch" />
                    <span className="min-w-0 flex-1">
                      <p className="font-semibold">{spot.placeName}</p>
                      <p className="truncate text-sm text-ink-muted">
                        {fishCountLabel(spot.fishCount)} · {spot.catchCount}{" "}
                        {spot.catchCount === 1 ? "trip" : "trips"} ·{" "}
                        {spot.species.slice(0, 3).join(", ")}
                        {spot.avgTempF != null ? ` · ~${spot.avgTempF}°F` : ""}
                        {spot.typicalCondition
                          ? ` · ${CONDITION_LABELS[spot.typicalCondition]}`
                          : ""}
                      </p>
                      <p className="text-xs text-ink-muted">Last {formatCatchWhen(spot.lastCaughtAt)}</p>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-2">
              {baitGroups.map((spot) => (
                <li key={spot.key}>
                  <button
                    type="button"
                    onClick={() => onSelect(spot.key)}
                    className={`journal-card flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${
                      spot.key === selected ? "ring-2 ring-copper" : ""
                    }`}
                  >
                    <OptionThumb src={baitGroupThumbSrc(spot)} kind="bait" />
                    <span className="min-w-0 flex-1">
                      <p className="font-semibold">{spot.placeName}</p>
                      <p className="truncate text-sm text-ink-muted">
                        {baitTypesLabel(spot.baitTypes)} · {spot.visitCount}{" "}
                        {spot.visitCount === 1 ? "visit" : "visits"}
                        {spot.avgTempF != null ? ` · ~${spot.avgTempF}°F` : ""}
                        {spot.typicalCondition
                          ? ` · ${CONDITION_LABELS[spot.typicalCondition]}`
                          : ""}
                      </p>
                      <p className="text-xs text-ink-muted">Last {formatCatchWhen(spot.lastLoggedAt)}</p>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <SharedToggle includeShared={includeShared} onChange={setIncludeShared} />
      <LocationMapSheet
        target={mapTarget}
        onClose={() => setMapTarget(null)}
        testId="spot-location-map"
        emptyTestId="spot-location-map-empty"
      />
    </div>
  );
}

function CatchSpotPanel({
  spot,
  viewerId,
  onOpenLocation,
}: {
  spot: SpotGroup;
  viewerId?: string;
  onOpenLocation: (target: LocationMapTarget) => void;
}) {
  const latestNotes = spot.catches.find((c) => c.notes?.trim())?.notes?.trim() ?? null;
  return (
    <section
      data-testid="spot-detail-panel"
      className="journal-card space-y-3 rounded-2xl p-3"
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onOpenLocation(targetFromSpotGroup(spot))}
          className="shrink-0"
          aria-label={`Show ${spot.placeName} on the map`}
        >
          <OptionThumb src={catchGroupThumbSrc(spot)} kind="catch" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl text-teal">{spot.placeName}</h2>
          <p className="text-sm text-ink-muted">
            {fishCountLabel(spot.fishCount)} · {spot.catchCount}{" "}
            {spot.catchCount === 1 ? "trip" : "trips"}
            {spot.speciesCounts?.length
              ? ` · ${spot.speciesCounts.map((row) => `${row.species} ${row.count}`).join(" · ")}`
              : ""}
          </p>
        </div>
      </div>
      <p className="text-sm text-ink-muted">
        {[
          spot.typicalTime ? TIME_OF_DAY_LABELS[spot.typicalTime] : null,
          spot.typicalCondition ? CONDITION_LABELS[spot.typicalCondition] : null,
          spot.avgTempF != null ? `~${spot.avgTempF}°F` : null,
          spot.latitude != null && spot.longitude != null
            ? formatCoords(spot.latitude, spot.longitude)
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || "No conditions logged yet."}
      </p>
      {latestNotes ? <p className="text-sm">{latestNotes}</p> : null}
      <ul className="space-y-1.5">
        {spot.catches.map((record) => (
          <li key={record.id}>
            <CatchVisitRow
              record={record}
              viewerId={viewerId}
              onOpenLocation={() => onOpenLocation(targetFromCatch(record))}
            />
          </li>
        ))}
      </ul>
      <Link href="/calendar" className="inline-block text-sm font-semibold text-teal">
        Filter the full journal
      </Link>
    </section>
  );
}

function BaitSpotPanel({
  group,
  viewerId,
  onOpenLocation,
}: {
  group: BaitSpotGroup;
  viewerId?: string;
  onOpenLocation: (target: LocationMapTarget) => void;
}) {
  const latestNotes = group.spots.find((s) => s.notes?.trim())?.notes?.trim() ?? null;
  return (
    <section
      data-testid="spot-detail-panel"
      className="journal-card space-y-3 rounded-2xl p-3"
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onOpenLocation(targetFromBaitGroup(group))}
          className="shrink-0"
          aria-label={`Show ${group.placeName} on the map`}
        >
          <OptionThumb src={baitGroupThumbSrc(group)} kind="bait" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl text-teal">{group.placeName}</h2>
          <p className="text-sm text-ink-muted">
            {baitTypesLabel(group.baitTypes)} · {group.visitCount}{" "}
            {group.visitCount === 1 ? "visit" : "visits"}
          </p>
        </div>
      </div>
      <p className="text-sm text-ink-muted">
        {[
          group.typicalTime ? TIME_OF_DAY_LABELS[group.typicalTime] : null,
          group.typicalCondition ? CONDITION_LABELS[group.typicalCondition] : null,
          group.avgTempF != null ? `~${group.avgTempF}°F` : null,
          group.latitude != null && group.longitude != null
            ? formatCoords(group.latitude, group.longitude)
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || "No conditions logged yet."}
      </p>
      {latestNotes ? <p className="text-sm">{latestNotes}</p> : null}
      <ul className="space-y-1.5">
        {group.spots.map((spot) => (
          <li key={spot.id}>
            <BaitVisitRow
              spot={spot}
              viewerId={viewerId}
              onOpenLocation={() => onOpenLocation(targetFromBait(spot))}
            />
          </li>
        ))}
      </ul>
      <Link href="/plan" className="inline-block text-sm font-semibold text-teal">
        See similar-condition windows on Plan
      </Link>
    </section>
  );
}

function CatchVisitRow({
  record,
  viewerId,
  onOpenLocation,
}: {
  record: CatchRecord;
  viewerId?: string;
  onOpenLocation: () => void;
}) {
  const theirs = viewerId && record.anglerId !== viewerId;
  return (
    <button
      type="button"
      onClick={onOpenLocation}
      className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-card px-2 py-1.5 text-left"
    >
      <OptionThumb src={catchRecordThumbSrc(record)} kind="catch" size={40} />
      <span className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {(record.speciesList?.length ? record.speciesList : [record.species]).join(", ")}
          {theirs ? ` · ${record.ownerName}` : ""}
        </p>
        <p className="truncate text-xs text-ink-muted">
          {formatCatchWhen(record.caughtAt)}
          {record.weatherCondition ? ` · ${CONDITION_LABELS[record.weatherCondition]}` : ""}
          {record.notes?.trim() ? ` · ${record.notes.trim()}` : ""}
        </p>
      </span>
    </button>
  );
}

function BaitVisitRow({
  spot,
  viewerId,
  onOpenLocation,
}: {
  spot: BaitSpot;
  viewerId?: string;
  onOpenLocation: () => void;
}) {
  const theirs = viewerId && spot.anglerId !== viewerId;
  return (
    <button
      type="button"
      onClick={onOpenLocation}
      className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-card px-2 py-1.5 text-left"
    >
      <OptionThumb src={baitRecordThumbSrc(spot)} kind="bait" size={40} />
      <span className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {baitTypesLabel(spot.baitTypes)}
          {theirs ? ` · ${spot.ownerName}` : ""}
        </p>
        <p className="truncate text-xs text-ink-muted">
          {formatCatchWhen(spot.loggedAt)}
          {spot.weatherCondition ? ` · ${CONDITION_LABELS[spot.weatherCondition]}` : ""}
          {spot.tide ? ` · ${spot.tide} tide` : ""}
          {spot.notes?.trim() ? ` · ${spot.notes.trim()}` : ""}
        </p>
      </span>
    </button>
  );
}
