"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { SharedToggle, sharedQuery, useIncludeShared } from "@/components/BuddyPanel";
import { SaveToPhotosButton } from "@/components/SaveToPhotosButton";
import { catchPhotoFilename, personalPhotoSrc } from "@/lib/photo";
import { baitTypesLabel } from "@/lib/bait";
import { speciesLabel } from "@/lib/species";
import { formatDateOnly, formatWeekdayDate, TIME_OF_DAY_LABELS } from "@/lib/time";
import { conditionLabel, VERY_STRONG_MATCH_CHIP, VERY_STRONG_MATCH_LABEL } from "@/lib/similar";
import type { BaitPlanSuggestion, BaitSpot, PlanResult, PlanSuggestion, SpotGroup } from "@/lib/types";

const SpotMap = dynamic(() => import("@/components/SpotMap").then((m) => m.SpotMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 items-center justify-center rounded-2xl border border-line bg-paper-deep text-sm text-ink-muted">
      Loading map…
    </div>
  ),
});

type PlanMapTarget = {
  title: string;
  kind: "catch" | "bait";
  strength: PlanSuggestion["strength"];
  reasons: string[];
  spots: SpotGroup[];
  baitSpots: BaitSpot[];
};

export function PlanClient() {
  const [days, setDays] = useState<3 | 5 | 7>(5);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeShared, setIncludeShared] = useIncludeShared();
  const [mapTarget, setMapTarget] = useState<PlanMapTarget | null>(null);

  useEffect(() => {
    let cancelled = false;
    const extra = sharedQuery(includeShared);
    fetch(`/api/plan?days=${days}${extra ? `&${extra}` : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setPlan(data);
          setError(null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not build a plan.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [days, includeShared]);

  const byDay = useMemo(() => {
    const map = new Map<string, PlanSuggestion[]>();
    for (const s of plan?.suggestions ?? []) {
      const list = map.get(s.window.date) ?? [];
      list.push(s);
      map.set(s.window.date, list);
    }
    return map;
  }, [plan]);

  const baitByDay = useMemo(() => {
    const map = new Map<string, BaitPlanSuggestion[]>();
    for (const s of plan?.baitSuggestions ?? []) {
      const list = map.get(s.window.date) ?? [];
      list.push(s);
      map.set(s.window.date, list);
    }
    return map;
  }, [plan]);

  const dayKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const date of byDay.keys()) keys.add(date);
    for (const date of baitByDay.keys()) keys.add(date);
    return [...keys].sort();
  }, [byDay, baitByDay]);

  return (
    <div className="space-y-4">
      <div className="page-intro">
        <h1 className="font-display text-3xl text-teal">Plan</h1>
        <p className="text-sm text-ink-muted">
          Upcoming windows matched to days you actually caught fish, plus bait holes that produced
          under similar tide, time, and weather. Tap a suggested spot for its map.
        </p>
      </div>

      <div className="flex gap-2">
        {([3, 5, 7] as const).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => {
              if (n !== days) setLoading(true);
              setDays(n);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              days === n ? "bg-teal text-white" : "border border-line bg-card"
            }`}
          >
            Next {n} days
          </button>
        ))}
      </div>

      {plan ? (
        <p className="rounded-2xl border border-line bg-card px-3 py-2 text-xs text-ink-muted">
          {plan.weatherSource === "demo" || plan.tideSource === "demo"
            ? "Demo forecast/tides until you add API keys. "
            : "Live forecast"}
          {plan.weatherSource === "openweather" ? " Weather: OpenWeather. " : null}
          {plan.tideSource === "worldtides" ? " Tides: WorldTides. " : null}
          Suggestions compare tide stage and height, clock time, sky, temp, and wind
          against productive trips and bait spots.
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-ink-muted">Matching upcoming days to your journal…</p>
      ) : error ? (
        <p className="text-sm text-copper">{error}</p>
      ) : !(plan?.suggestions?.length || plan?.baitSuggestions?.length) ? (
        <p className="text-sm text-ink-muted">
          No close matches in this window. Log more catches or bait spots, or try a longer range.
        </p>
      ) : (
        dayKeys.map((date) => {
          const items = byDay.get(date) ?? [];
          const baitItems = baitByDay.get(date) ?? [];
          return (
          <section key={date} className="space-y-2">
            <h2 className="font-display text-xl text-teal">{formatWeekdayDate(date)}</h2>
            {items.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                showOwner={includeShared}
                onOpenMap={() => setMapTarget(mapTargetFromCatch(s))}
              />
            ))}
            {baitItems.length ? (
              <>
                <h3 className="pt-1 text-sm font-semibold text-copper" data-testid="bait-plan-heading">
                  Bait under similar conditions
                </h3>
                {baitItems.map((s) => (
                  <BaitSuggestionCard
                    key={s.id}
                    suggestion={s}
                    showOwner={includeShared}
                    onOpenMap={() => setMapTarget(mapTargetFromBait(s))}
                  />
                ))}
              </>
            ) : null}
          </section>
          );
        })
      )}
      <SharedToggle includeShared={includeShared} onChange={setIncludeShared} />
      <PlanSpotSheet target={mapTarget} onClose={() => setMapTarget(null)} />
    </div>
  );
}

function SuggestionCard({
  suggestion,
  showOwner,
  onOpenMap,
}: {
  suggestion: PlanSuggestion;
  showOwner: boolean;
  onOpenMap: () => void;
}) {
  const w = suggestion.window;
  const matchPhotos = suggestion.matches.map((m) => ({
    id: m.catch.id,
    src: personalPhotoSrc(m.catch.photoPath),
    species: speciesLabel(m.catch.speciesList?.length ? m.catch.speciesList : m.catch.species),
    date: formatDateOnly(m.catch.caughtAt),
    ownerName: m.catch.ownerName,
    reasons: m.reasons,
    filename: catchPhotoFilename({
      species: m.catch.speciesList?.length ? m.catch.speciesList : m.catch.species,
      caughtAt: m.catch.caughtAt,
      photoPath: m.catch.photoPath,
    }),
  }));
  const firstPhoto = matchPhotos.find((m) => m.src);
  const canMap = suggestion.latitude != null && suggestion.longitude != null;
  return (
    <article className="journal-card overflow-hidden rounded-2xl">
      <div className="flex gap-3 p-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-paper-deep">
          {firstPhoto?.src ? (
            <Link href={`/catch/${firstPhoto.id}`} className="h-full w-full" aria-label={firstPhoto.species}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={firstPhoto.src} alt={firstPhoto.species} className="h-full w-full object-cover" />
            </Link>
          ) : (
            <span className="px-1.5 text-center text-[10px] leading-tight text-ink-muted">
              No photo from that trip
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={canMap ? onOpenMap : undefined}
              disabled={!canMap}
              className="min-w-0 text-left"
            >
              <span className="font-semibold">{suggestion.placeName}</span>
              {canMap ? (
                <span className="text-[11px] font-semibold text-teal">Show on map</span>
              ) : null}
            </button>
            <StrengthBadge strength={suggestion.strength} />
          </div>
          <p className="text-sm text-ink-muted">
            {TIME_OF_DAY_LABELS[w.timeOfDay]}
            {w.temperatureF != null ? ` · ${Math.round(w.temperatureF)}°F` : ""}
            {w.weatherCondition ? ` · ${conditionLabel(w.weatherCondition)}` : ""}
            {w.windSpeedMph != null
              ? ` · ${w.windDirection ? `${w.windDirection} ` : ""}${Math.round(w.windSpeedMph)} mph`
              : w.windDirection
                ? ` · ${w.windDirection}`
                : ""}
            {w.moonPhase ? ` · ${w.moonPhase}` : ""}
            {w.pressureInHg != null ? ` · ${w.pressureInHg.toFixed(2)} inHg` : ""}
            {w.tide ? ` · ${w.tide} tide` : ""}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={canMap ? onOpenMap : undefined}
        disabled={!canMap}
        className="w-full px-3 pb-2 text-left text-sm"
      >
        {suggestion.headline}
      </button>
      {suggestion.strength === "very-strong" ? (
        <p className="px-3 text-[11px] font-semibold text-teal">{VERY_STRONG_MATCH_LABEL}</p>
      ) : null}
      <p className="px-3 text-xs text-ink-muted">
        Why: {suggestion.reasons.slice(0, 5).join(" · ") || "pattern overlap"}
      </p>
      <p className="px-3 pt-2 text-[11px] text-ink-muted">
        Photos are from the matching trips you logged — never stock or placeholder fish.
      </p>
      <ul className="space-y-2 px-3 py-3">
        {matchPhotos.map((m) => (
          <li key={m.id} className="flex gap-2">
            {m.src ? (
              <Link
                href={`/catch/${m.id}`}
                className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-paper-deep"
                aria-label={`${m.species} photo`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.src} alt={m.species} className="h-full w-full object-cover" />
              </Link>
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-paper-deep text-center text-[9px] leading-tight text-ink-muted">
                No photo
              </span>
            )}
            <div className="min-w-0">
              <Link href={`/catch/${m.id}`} className="text-sm font-semibold text-teal">
                {m.species} · {m.date}
              </Link>
              {m.src ? (
                <SaveToPhotosButton src={m.src} filename={m.filename} variant="text" />
              ) : null}
              {showOwner ? (
                <p className="text-[11px] font-semibold text-copper">{m.ownerName}</p>
              ) : null}
              <p className="text-xs text-ink-muted">{m.reasons.slice(0, 3).join(", ")}</p>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}

function BaitSuggestionCard({
  suggestion,
  showOwner,
  onOpenMap,
}: {
  suggestion: BaitPlanSuggestion;
  showOwner: boolean;
  onOpenMap: () => void;
}) {
  const w = suggestion.window;
  const first = suggestion.matches[0]?.baitSpot;
  const src = first ? personalPhotoSrc(first.photoPath) : null;
  const canMap = suggestion.latitude != null && suggestion.longitude != null;
  return (
    <article className="journal-card overflow-hidden rounded-2xl">
      <div className="flex gap-3 p-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-paper-deep">
          {src ? (
            <Link href={`/bait/${first!.id}`} className="h-full w-full" aria-label="Bait spot photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </Link>
          ) : (
            <span className="px-1.5 text-center text-[10px] leading-tight text-ink-muted">Bait</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={canMap ? onOpenMap : undefined}
              disabled={!canMap}
              className="min-w-0 text-left"
            >
              <span className="font-semibold">{suggestion.placeName}</span>
              {canMap ? (
                <span className="text-[11px] font-semibold text-teal">Show on map</span>
              ) : null}
            </button>
            <StrengthBadge strength={suggestion.strength} />
          </div>
          <p className="text-sm text-ink-muted">
            {baitTypesLabel(suggestion.baitTypes)} · {TIME_OF_DAY_LABELS[w.timeOfDay]}
            {w.temperatureF != null ? ` · ${Math.round(w.temperatureF)}°F` : ""}
            {w.weatherCondition ? ` · ${conditionLabel(w.weatherCondition)}` : ""}
            {w.tide ? ` · ${w.tide} tide` : ""}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={canMap ? onOpenMap : undefined}
        disabled={!canMap}
        className="w-full px-3 pb-2 text-left text-sm"
      >
        {suggestion.headline}
      </button>
      {suggestion.strength === "very-strong" ? (
        <p className="px-3 text-[11px] font-semibold text-teal">{VERY_STRONG_MATCH_LABEL}</p>
      ) : null}
      <p className="px-3 text-xs text-ink-muted">
        Why: {suggestion.reasons.slice(0, 5).join(" · ") || "pattern overlap"}
      </p>
      <ul className="space-y-2 px-3 py-3">
        {suggestion.matches.map((m) => (
          <li key={m.baitSpot.id}>
            <Link href={`/bait/${m.baitSpot.id}`} className="text-sm font-semibold text-teal">
              {baitTypesLabel(m.baitSpot.baitTypes)} · {formatDateOnly(m.baitSpot.loggedAt)}
            </Link>
            {showOwner ? (
              <p className="text-[11px] font-semibold text-copper">{m.baitSpot.ownerName}</p>
            ) : null}
            <p className="text-xs text-ink-muted">{m.reasons.slice(0, 3).join(", ")}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}

function StrengthBadge({ strength }: { strength: PlanSuggestion["strength"] }) {
  if (strength === "very-strong") {
    return (
      <span className="max-w-[9.5rem] rounded-full bg-good px-2 py-0.5 text-right text-[10px] font-semibold leading-snug text-white">
        {VERY_STRONG_MATCH_CHIP}
      </span>
    );
  }
  const label = strength === "strong" ? "Strong match" : strength === "good" ? "Good match" : "Lean match";
  const cls =
    strength === "strong"
      ? "bg-good text-white"
      : strength === "good"
        ? "bg-teal text-white"
        : "bg-paper-deep text-ink";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>;
}

function mapTargetFromCatch(suggestion: PlanSuggestion): PlanMapTarget | null {
  if (suggestion.latitude == null || suggestion.longitude == null) return null;
  return {
    title: suggestion.placeName,
    kind: "catch",
    strength: suggestion.strength,
    reasons: suggestion.reasons,
    spots: [
      {
        key: suggestion.spotKey,
        placeName: suggestion.placeName,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        catchCount: suggestion.matches.length,
        fishCount: suggestion.matches.reduce((n, m) => n + (m.catch.fishCount ?? 1), 0),
        species: [],
        speciesCounts: [],
        lastCaughtAt: suggestion.matches[0]?.catch.caughtAt ?? suggestion.window.at,
        typicalCondition: suggestion.window.weatherCondition,
        typicalTime: suggestion.window.timeOfDay,
        avgTempF: suggestion.window.temperatureF,
        catches: suggestion.matches.map((m) => m.catch),
      },
    ],
    baitSpots: [],
  };
}

function mapTargetFromBait(suggestion: BaitPlanSuggestion): PlanMapTarget | null {
  if (suggestion.latitude == null || suggestion.longitude == null) return null;
  const baitSpots = suggestion.matches.map((m) => m.baitSpot);
  const pinned = baitSpots.filter((s) => s.latitude != null && s.longitude != null);
  return {
    title: suggestion.placeName,
    kind: "bait",
    strength: suggestion.strength,
    reasons: suggestion.reasons,
    spots: [],
    baitSpots: pinned.length
      ? pinned
      : [
          {
            ...suggestion.matches[0]?.baitSpot,
            latitude: suggestion.latitude,
            longitude: suggestion.longitude,
            placeName: suggestion.placeName,
          } as BaitSpot,
        ].filter((s) => s.id),
  };
}

function PlanSpotSheet({
  target,
  onClose,
}: {
  target: PlanMapTarget | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!target) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, onClose]);

  if (!target) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-spot-map-title"
      data-testid="plan-spot-map"
      onClick={onClose}
    >
      <div
        className="journal-card w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 p-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-copper">
              {target.kind === "bait" ? "Bait hole" : "Catch spot"}
            </p>
            <h3 id="plan-spot-map-title" className="font-display text-xl text-teal">
              {target.title}
            </h3>
            {target.strength === "very-strong" ? (
              <p className="mt-1 text-[11px] font-semibold text-teal">{VERY_STRONG_MATCH_LABEL}</p>
            ) : null}
            <p className="mt-1 text-xs text-ink-muted">
              {target.reasons.slice(0, 3).join(" · ") || "Matched to a logged trip"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-3 py-1 text-xs font-semibold"
          >
            Close
          </button>
        </div>
        <div className="px-3 pb-3">
          <SpotMap
            spots={target.spots}
            baitSpots={target.baitSpots}
            selectedKey={target.spots[0]?.key ?? null}
            className="h-72 w-full overflow-hidden rounded-2xl border border-line bg-paper-deep"
          />
        </div>
      </div>
    </div>
  );
}
