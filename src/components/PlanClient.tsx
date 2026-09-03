"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { SharedToggle, sharedQuery, useIncludeShared } from "@/components/BuddyPanel";
import { SaveToPhotosButton } from "@/components/SaveToPhotosButton";
import { catchPhotoFilename, personalPhotoSrc } from "@/lib/photo";
import { baitTypesLabel } from "@/lib/bait";
import { speciesLabel } from "@/lib/species";
import { PlanDayNotes } from "@/components/CalendarNotes";
import { monthGrid, monthLabel, shiftMonth, todayKey, WEEKDAY_LABELS } from "@/lib/calendar";
import { groupNotesByDay } from "@/lib/notes";
import { parsePlanDate, planLookupFailureNote, planWhyChips, forecastWindowWhenLabel } from "@/lib/plan";
import { formatDateOnly, formatWeekdayDate } from "@/lib/time";
import { conditionLabel, veryStrongMatchChip, veryStrongMatchLabel } from "@/lib/similar";
import type {
  BaitPlanSuggestion,
  BaitSpot,
  CalendarNote,
  CalendarNoteInput,
  PlanResult,
  PlanSuggestion,
  SpotGroup,
} from "@/lib/types";

const TAP_RESET =
  "outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-teal";

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
  windowAt?: string;
  spots: SpotGroup[];
  baitSpots: BaitSpot[];
};

export function PlanClient({
  initialDate,
  initialNotes = [],
}: {
  initialDate: string | null;
  initialNotes?: CalendarNote[];
}) {
  const now = new Date();
  const [selectedDay, setSelectedDay] = useState<string | null>(() =>
    parsePlanDate(initialDate) ? initialDate : null,
  );
  const [notes, setNotes] = useState<CalendarNote[]>(initialNotes);
  const [year, setYear] = useState(() => {
    const parsed = parsePlanDate(selectedDay);
    return parsed ? parsed.getFullYear() : now.getFullYear();
  });
  const [month, setMonth] = useState(() => {
    const parsed = parsePlanDate(selectedDay);
    return parsed ? parsed.getMonth() : now.getMonth();
  });
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includeShared, setIncludeShared] = useIncludeShared();
  const [mapTarget, setMapTarget] = useState<PlanMapTarget | null>(null);
  const resultsRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function onPop() {
      const date = new URLSearchParams(window.location.search).get("date");
      setSelectedDay(parsePlanDate(date) ? date : null);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
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

  async function onCreateNote(input: CalendarNoteInput) {
    const res = await fetch("/api/calendar-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error("save failed");
    const data = await res.json();
    if (data.note) setNotes((current) => [...current, data.note]);
  }

  async function onUpdateNote(id: string, input: CalendarNoteInput) {
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
  }

  async function onDeleteNote(id: string) {
    const res = await fetch(`/api/calendar-notes/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("delete failed");
    setNotes((current) => current.filter((n) => n.id !== id));
  }

  useEffect(() => {
    if (!selectedDay) return;
    const day = selectedDay;
    const shared = includeShared;
    fetch(`/api/plan?date=${day}${sharedQuery(shared) ? `&${sharedQuery(shared)}` : ""}`)
      .then((r) => {
        if (!r.ok) throw new Error("plan failed");
        return r.json();
      })
      .then((data: PlanResult) => {
        setPlan(data);
        setError(null);
      })
      .catch(() => {
        setError("Could not build a plan.");
        setPlan(null);
      });
  }, [selectedDay, includeShared]);

  useEffect(() => {
    if (!selectedDay || !plan || !resultsRef.current) return;
    resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedDay, plan]);

  const suggestions = plan?.suggestions ?? [];
  const baitSuggestions = plan?.baitSuggestions ?? [];
  const lookupFailure = planLookupFailureNote(plan?.note);
  const notesByDay = groupNotesByDay(notes);
  const notedDays = new Set(notesByDay.keys());
  const selectedNotes = selectedDay ? (notesByDay.get(selectedDay) ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="page-intro">
        <h1 className="font-display text-3xl text-teal" data-testid="plan-a-day">
          Plan a day
        </h1>
        <p className="text-sm text-ink-muted">
          Tap one day on the calendar. We match that date’s tide, time, and weather to spots that
          produced — including very strong matches with matching tides. Add a note for that day if
          you want. Tap a match to open that trip. Show spot on map for the hole.
        </p>
      </div>

      <PlanDayCalendar
        year={year}
        month={month}
        selectedDay={selectedDay}
        notedDays={notedDays}
        onMonthChange={(next) => {
          setYear(next.year);
          setMonth(next.month);
        }}
        onSelectDay={(date) => {
          setSelectedDay(date);
          window.history.pushState(null, "", `/plan?date=${date}`);
        }}
      />

      {!selectedDay ? (
        <p className="on-wash-chip text-sm">Tap a day to plan it.</p>
      ) : (
        <section
          ref={resultsRef}
          className="space-y-3"
          data-testid="plan-day-results"
        >
          <h2 className="on-wash-chip w-fit font-display text-xl text-teal">
            {formatWeekdayDate(selectedDay)}
          </h2>
          <PlanDayNotes
            key={selectedDay}
            day={selectedDay}
            notes={selectedNotes}
            onCreate={onCreateNote}
            onUpdate={onUpdateNote}
            onDelete={onDeleteNote}
          />
          {lookupFailure ? (
            <p className="on-wash-chip text-xs text-ink-muted" data-testid="plan-lookup-failure">
              {lookupFailure}
            </p>
          ) : null}
          {!plan && !error ? (
            <p className="on-wash-chip text-sm">Matching that day to your journal…</p>
          ) : error ? (
            <p className="on-wash-chip text-sm text-copper">{error}</p>
          ) : suggestions.length || baitSuggestions.length ? (
            <>
              {suggestions.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  showOwner={includeShared}
                  onOpenMap={() => setMapTarget(mapTargetFromCatch(s))}
                />
              ))}
              {baitSuggestions.length ? (
                <>
                  <h3
                    className="on-wash-chip w-fit pt-1 text-sm font-semibold text-copper"
                    data-testid="bait-plan-heading"
                  >
                    Bait under similar conditions
                  </h3>
                  {baitSuggestions.map((s) => (
                    <BaitSuggestionCard
                      key={s.id}
                      suggestion={s}
                      showOwner={includeShared}
                      onOpenMap={() => setMapTarget(mapTargetFromBait(s))}
                    />
                  ))}
                </>
              ) : null}
            </>
          ) : (
            <p className="on-wash-chip text-sm">
              No close matches for this day. Log more catches or bait spots, or pick another date.
            </p>
          )}
        </section>
      )}
      <SharedToggle includeShared={includeShared} onChange={setIncludeShared} />
      <PlanSpotSheet target={mapTarget} onClose={() => setMapTarget(null)} />
    </div>
  );
}

function PlanDayCalendar({
  year,
  month,
  selectedDay,
  notedDays,
  onMonthChange,
  onSelectDay,
}: {
  year: number;
  month: number;
  selectedDay: string | null;
  notedDays: Set<string>;
  onMonthChange: (next: { year: number; month: number }) => void;
  onSelectDay: (date: string) => void;
}) {
  const cells = monthGrid(year, month);
  const today = todayKey();
  return (
    <section className="journal-card rounded-2xl px-3 py-3" data-testid="plan-day-calendar">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          className="rounded-full px-3 py-1 text-sm font-semibold text-teal"
          onClick={() => onMonthChange(shiftMonth(year, month, -1))}
          aria-label="Previous month"
        >
          ‹
        </button>
        <h2 className="font-display text-lg text-teal">{monthLabel(year, month)}</h2>
        <button
          type="button"
          className="rounded-full px-3 py-1 text-sm font-semibold text-teal"
          onClick={() => onMonthChange(shiftMonth(year, month, 1))}
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-ink-muted">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const isSelected = selectedDay === cell.date;
          const isToday = cell.date === today;
          const hasNote = notedDays.has(cell.date);
          return (
            <Link
              key={cell.date}
              href={`/plan?date=${cell.date}`}
              scroll={false}
              onClick={(event) => {
                event.preventDefault();
                onSelectDay(cell.date);
              }}
              aria-label={hasNote ? `${cell.date}, has notes` : cell.date}
              aria-current={isSelected ? "date" : undefined}
              data-testid={`plan-day-${cell.date}`}
              className={`flex min-h-10 flex-col items-center justify-center rounded-xl py-2 text-sm ${TAP_RESET} ${
                isSelected
                  ? "font-semibold ring-2 ring-inset ring-teal"
                  : isToday
                    ? "ring-1 ring-inset ring-copper"
                    : "bg-card"
              } ${cell.inMonth ? "" : "opacity-35"}`}
            >
              {cell.day}
              {hasNote ? (
                <span
                  className={`mt-0.5 h-1.5 w-1.5 rounded-full ${isSelected ? "bg-teal" : "bg-copper"}`}
                  data-testid="plan-day-has-note"
                />
              ) : (
                <span className="mt-0.5 h-1.5 w-1.5" />
              )}
            </Link>
          );
        })}
      </div>
    </section>
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
  const primary = matchPhotos[0];
  const canMap = suggestion.latitude != null && suggestion.longitude != null;
  if (!primary) return null;

  function openSpotMap(event: { preventDefault: () => void; stopPropagation: () => void }) {
    event.preventDefault();
    event.stopPropagation();
    onOpenMap();
  }

  return (
    <article className="journal-card overflow-hidden rounded-2xl">
      <Link
        href={`/catch/${primary.id}`}
        className={`block p-3 ${TAP_RESET}`}
        aria-label={`${primary.species} catch`}
        data-testid="plan-match-card"
      >
        <div className="flex gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-paper-deep">
            {primary.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={primary.src} alt="" className="h-full w-full object-cover" data-testid="plan-match-photo" />
            ) : (
              <span className="px-1.5 text-center text-[10px] leading-tight text-ink-muted">
                No photo from that trip
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold">{suggestion.placeName}</span>
              <StrengthBadge strength={suggestion.strength} atIso={w.at} />
            </div>
            <p className="text-sm text-ink-muted">
              {forecastWindowWhenLabel(w, suggestion.strength)}
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
        <p className="pt-2 text-sm">{suggestion.headline}</p>
        {suggestion.strength === "very-strong" ? (
          <p className="pt-1 text-[11px] font-semibold text-teal">{veryStrongMatchLabel(w.at)}</p>
        ) : null}
        <div className="pt-1">
          <MatchWhy
            reasons={suggestion.reasons}
            strength={suggestion.strength}
            placeName={suggestion.placeName}
            species={primary.species}
            timeOfDay={w.timeOfDay}
            windowAt={w.at}
          />
        </div>
      </Link>
      {canMap ? (
        <div className="px-3 pb-1">
          <button
            type="button"
            onClick={openSpotMap}
            onPointerDown={(event) => event.stopPropagation()}
            className={`text-[11px] font-semibold text-teal ${TAP_RESET}`}
            data-testid="plan-show-spot-map"
          >
            Show spot on map
          </button>
        </div>
      ) : null}
      <ul className="space-y-2 px-3 py-3">
        {matchPhotos.map((m) => (
          <li key={m.id} className="flex items-start gap-2">
            <Link
              href={`/catch/${m.id}`}
              className={`flex min-w-0 flex-1 gap-2 ${TAP_RESET}`}
              aria-label={`${m.species} catch`}
              data-testid="plan-match-row"
            >
              {m.src ? (
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-paper-deep">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.src} alt="" className="h-full w-full object-cover" data-testid="plan-match-photo" />
                </span>
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-paper-deep text-center text-[9px] leading-tight text-ink-muted">
                  No photo
                </span>
              )}
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-teal">
                  {m.species} · {m.date}
                </span>
                {showOwner ? (
                  <span className="block text-[11px] font-semibold text-copper">{m.ownerName}</span>
                ) : null}
                <span className="block text-xs text-ink-muted">{m.reasons.slice(0, 3).join(", ")}</span>
              </span>
            </Link>
            {m.src ? (
              <SaveToPhotosButton src={m.src} filename={m.filename} variant="text" />
            ) : null}
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
  if (!first) return null;

  function openSpotMap(event: { preventDefault: () => void; stopPropagation: () => void }) {
    event.preventDefault();
    event.stopPropagation();
    onOpenMap();
  }

  return (
    <article className="journal-card overflow-hidden rounded-2xl">
      <Link
        href={`/bait/${first.id}`}
        className={`block p-3 ${TAP_RESET}`}
        aria-label={`${baitTypesLabel(first.baitTypes)} bait spot`}
        data-testid="plan-bait-card"
      >
        <div className="flex gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-paper-deep">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" className="h-full w-full object-cover" data-testid="plan-bait-photo" />
            ) : (
              <span className="px-1.5 text-center text-[10px] leading-tight text-ink-muted">Bait</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold">{suggestion.placeName}</span>
              <StrengthBadge strength={suggestion.strength} atIso={w.at} />
            </div>
            <p className="text-sm text-ink-muted">
              {baitTypesLabel(suggestion.baitTypes)} · {forecastWindowWhenLabel(w, suggestion.strength)}
              {w.temperatureF != null ? ` · ${Math.round(w.temperatureF)}°F` : ""}
              {w.weatherCondition ? ` · ${conditionLabel(w.weatherCondition)}` : ""}
              {w.tide ? ` · ${w.tide} tide` : ""}
            </p>
          </div>
        </div>
        <p className="pt-2 text-sm">{suggestion.headline}</p>
        {suggestion.strength === "very-strong" ? (
          <p className="pt-1 text-[11px] font-semibold text-teal">{veryStrongMatchLabel(w.at)}</p>
        ) : null}
        <div className="pt-1">
          <MatchWhy
            reasons={suggestion.reasons}
            strength={suggestion.strength}
            placeName={suggestion.placeName}
            species={baitTypesLabel(suggestion.baitTypes)}
            timeOfDay={w.timeOfDay}
            windowAt={w.at}
          />
        </div>
      </Link>
      {canMap ? (
        <div className="px-3 pb-1">
          <button
            type="button"
            onClick={openSpotMap}
            onPointerDown={(event) => event.stopPropagation()}
            className={`text-[11px] font-semibold text-teal ${TAP_RESET}`}
            data-testid="plan-show-spot-map"
          >
            Show spot on map
          </button>
        </div>
      ) : null}
      <ul className="space-y-2 px-3 py-3">
        {suggestion.matches.map((m) => {
          const baitSrc = personalPhotoSrc(m.baitSpot.photoPath);
          return (
            <li key={m.baitSpot.id}>
              <Link
                href={`/bait/${m.baitSpot.id}`}
                className={`flex gap-2 ${TAP_RESET}`}
                aria-label={`${baitTypesLabel(m.baitSpot.baitTypes)} bait spot`}
                data-testid="plan-bait-row"
              >
                {baitSrc ? (
                  <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-paper-deep">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={baitSrc} alt="" className="h-full w-full object-cover" data-testid="plan-bait-photo" />
                  </span>
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-paper-deep text-center text-[9px] leading-tight text-ink-muted">
                    Bait
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-teal">
                    {baitTypesLabel(m.baitSpot.baitTypes)} · {formatDateOnly(m.baitSpot.loggedAt)}
                  </span>
                  {showOwner ? (
                    <span className="block text-[11px] font-semibold text-copper">{m.baitSpot.ownerName}</span>
                  ) : null}
                  <span className="block text-xs text-ink-muted">{m.reasons.slice(0, 3).join(", ")}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function MatchWhy({
  reasons,
  strength,
  placeName,
  species,
  timeOfDay,
  windowAt,
}: {
  reasons: string[];
  strength: PlanSuggestion["strength"];
  placeName?: string | null;
  species?: string | null;
  timeOfDay?: PlanSuggestion["window"]["timeOfDay"] | null;
  windowAt?: string | null;
}) {
  const bits = planWhyChips({ reasons, strength, placeName, species, timeOfDay, windowAt });
  if ((strength === "strong" || strength === "very-strong") && bits.length) {
    return (
      <ul className="flex flex-wrap gap-1" data-testid="plan-match-why">
        {bits.map((reason) => (
          <li
            key={reason}
            className="rounded-full bg-paper-deep px-2 py-0.5 text-[11px] font-semibold text-ink"
          >
            {reason}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p className="text-xs text-ink-muted">
      Why: {reasons.slice(0, 5).join(" · ") || "pattern overlap"}
    </p>
  );
}

function StrengthBadge({
  strength,
  atIso,
}: {
  strength: PlanSuggestion["strength"];
  atIso?: string;
}) {
  if (strength === "very-strong") {
    return (
      <span className="max-w-[11rem] rounded-full bg-good px-2 py-0.5 text-right text-[10px] font-semibold leading-snug text-white">
        {veryStrongMatchChip(atIso)}
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
    windowAt: suggestion.window.at,
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
    windowAt: suggestion.window.at,
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
              <p className="mt-1 text-[11px] font-semibold text-teal">
                {veryStrongMatchLabel(target.windowAt)}
              </p>
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
