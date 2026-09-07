"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SharedToggle, sharedQuery, useIncludeShared } from "@/components/BuddyPanel";
import { SaveToPhotosButton } from "@/components/SaveToPhotosButton";
import { catchPhotoFilename, personalPhotoSrc } from "@/lib/photo";
import { baitTypesLabel } from "@/lib/bait";
import { speciesLabel } from "@/lib/species";
import { PlanDayNotes } from "@/components/CalendarNotes";
import { CHANGES_SAVED_LABEL } from "@/lib/feedback";
import { monthGrid, monthLabel, shiftMonth, todayKey, WEEKDAY_LABELS } from "@/lib/calendar";
import {
  addPlanSpotToDay,
  dayHasPlanSpot,
  groupNotesByDay,
  journalNotesForCalendarLog,
  normalizeNotePlace,
  plannedSpotsOnDay,
} from "@/lib/notes";
import {
  parsePlanDate,
  planLookupFailureNote,
  planPlaceToAdd,
  planWhyChips,
  forecastWindowWhenLabel,
  splitBaitSuggestionByPlace,
  splitPlanSuggestionByPlace,
} from "@/lib/plan";
import { formatDateOnly, formatWeekdayDate } from "@/lib/time";
import { conditionLabel, veryStrongMatchChip, veryStrongMatchLabel } from "@/lib/similar";
import type {
  BaitPlanSuggestion,
  CalendarNote,
  CalendarNoteInput,
  PlanResult,
  PlanSuggestion,
} from "@/lib/types";

const TAP_RESET =
  "outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-teal";

function photosForPlannedPlaces(
  spots: CalendarNote[],
  suggestions: PlanSuggestion[],
  baitSuggestions: BaitPlanSuggestion[],
): { id: string; placeName: string; src: string; href: string }[] {
  const photos: { id: string; placeName: string; src: string; href: string }[] = [];
  for (const note of spots) {
    const key = normalizeNotePlace(note.placeName);
    if (!key) continue;
    const catchCard = suggestions.find((s) => normalizeNotePlace(s.placeName) === key);
    const catchMatch = catchCard?.matches.find((m) => personalPhotoSrc(m.catch.photoPath));
    if (catchMatch) {
      const src = personalPhotoSrc(catchMatch.catch.photoPath);
      if (src) {
        photos.push({
          id: note.id,
          placeName: note.placeName ?? catchCard?.placeName ?? "spot",
          src,
          href: `/catch/${catchMatch.catch.id}`,
        });
        continue;
      }
    }
    const baitCard = baitSuggestions.find((s) => normalizeNotePlace(s.placeName) === key);
    const baitMatch = baitCard?.matches.find((m) => personalPhotoSrc(m.baitSpot.photoPath));
    if (baitMatch) {
      const src = personalPhotoSrc(baitMatch.baitSpot.photoPath);
      if (src) {
        photos.push({
          id: note.id,
          placeName: note.placeName ?? baitCard?.placeName ?? "spot",
          src,
          href: `/bait/${baitMatch.baitSpot.id}`,
        });
      }
    }
  }
  return photos;
}

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
  const [addingSpotId, setAddingSpotId] = useState<string | null>(null);
  const [spotSaved, setSpotSaved] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
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
    fetch("/api/calendar-notes?for=plan", { cache: "no-store" })
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

  const suggestions = (plan?.suggestions ?? []).flatMap(splitPlanSuggestionByPlace);
  const baitSuggestions = (plan?.baitSuggestions ?? []).flatMap(splitBaitSuggestionByPlace);
  const lookupFailure = planLookupFailureNote(plan?.note);
  const notesByDay = groupNotesByDay(notes);
  const notedDays = new Set(notesByDay.keys());
  const selectedNotes = selectedDay ? (notesByDay.get(selectedDay) ?? []) : [];
  const journalNotes = journalNotesForCalendarLog(selectedNotes);
  const spotsOnDay = plannedSpotsOnDay(selectedNotes);
  const plannedPhotos = photosForPlannedPlaces(spotsOnDay, suggestions, baitSuggestions);

  async function onAddSpot(spot: { placeName?: string | null; speciesTargets?: string[] | null }) {
    if (!selectedDay) return;
    const input = addPlanSpotToDay(selectedNotes, selectedDay, spot);
    if (!input?.placeName) return;
    setAddingSpotId(input.placeName);
    setAddError(null);
    try {
      await onCreateNote(input);
      setSpotSaved(true);
    } catch {
      setAddError("Could not add that spot to this day.");
    } finally {
      setAddingSpotId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="page-intro">
        <h1 className="font-display text-3xl text-teal" data-testid="plan-a-day">
          Plan a day
        </h1>
        <p className="text-sm text-ink-muted">
          Tap one day on the calendar. We match that date’s tide, time, and weather to spots that
          produced — including very strong matches with matching tides. Tap Add on a place to put
          only that one place on the day. Add a note if you want. Tap a match to open that trip.
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
          setSpotSaved(false);
          setAddError(null);
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
          <section
            className="journal-card space-y-3 rounded-2xl border-2 border-teal/45 p-3"
            data-testid="plan-planned"
          >
            <h3 className="font-display text-xl text-teal">Planned</h3>
            <p className="text-sm text-ink-muted">{formatWeekdayDate(selectedDay)}</p>
            {spotSaved ? (
              <p data-testid="changes-saved" className="text-sm font-semibold text-teal">
                {CHANGES_SAVED_LABEL}
              </p>
            ) : null}
            {addError ? <p className="text-sm text-copper">{addError}</p> : null}
            {spotsOnDay.length ? (
              <div data-testid="plan-day-spots">
                <ul className="flex flex-wrap gap-1">
                  {spotsOnDay.map((note) => (
                    <li
                      key={note.id}
                      className="rounded-full bg-teal/15 px-2.5 py-1 text-xs font-semibold text-teal"
                      data-testid="plan-day-spot"
                    >
                      {note.placeName}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {plannedPhotos.length ? (
              <ul className="flex flex-wrap gap-2" data-testid="plan-planned-photos">
                {plannedPhotos.map((photo) => (
                  <li key={photo.id}>
                    <Link
                      href={photo.href}
                      className={`block overflow-hidden rounded-xl ${TAP_RESET}`}
                      aria-label={`${photo.placeName} photo`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.src}
                        alt=""
                        className="h-16 w-16 object-cover"
                        data-testid="plan-planned-photo"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            {!spotsOnDay.length && !journalNotes.length && !plannedPhotos.length ? (
              <p className="text-sm text-ink-muted">
                Nothing planned yet. Add a place below or write a note.
              </p>
            ) : null}
            <PlanDayNotes
              key={selectedDay}
              day={selectedDay}
              notes={journalNotes}
              embedded
              onCreate={onCreateNote}
              onUpdate={onUpdateNote}
              onDelete={onDeleteNote}
            />
          </section>
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
              {suggestions.length ? (
                <h3
                  className="on-wash-chip w-fit pt-1 text-sm font-semibold text-teal"
                  data-testid="plan-suggested-spots"
                >
                  Suggested spots
                </h3>
              ) : null}
              {suggestions.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  showOwner={includeShared}
                  added={dayHasPlanSpot(selectedNotes, s.placeName)}
                  adding={addingSpotId === s.placeName}
                  onAdd={() => {
                    const spot = planPlaceToAdd(s);
                    if (spot) void onAddSpot(spot);
                  }}
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
                      added={dayHasPlanSpot(selectedNotes, s.placeName)}
                      adding={addingSpotId === s.placeName}
                      onAdd={() => void onAddSpot({ placeName: s.placeName })}
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
  added,
  adding,
  onAdd,
}: {
  suggestion: PlanSuggestion;
  showOwner: boolean;
  added: boolean;
  adding: boolean;
  onAdd: () => void;
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
  if (!primary) return null;

  const canAdd = Boolean(suggestion.placeName?.trim());

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
      {canAdd ? (
        <div className="flex items-center justify-end gap-2 px-3 pb-2">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!added && !adding) onAdd();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            disabled={added || adding}
            aria-label={
              added
                ? `${suggestion.placeName} added to this day`
                : `Add ${suggestion.placeName} to this day`
            }
            className={`rounded-full px-3 py-1 text-xs font-semibold ${TAP_RESET} ${
              added
                ? "bg-teal/15 text-teal"
                : "border border-line bg-card text-teal"
            } disabled:opacity-60`}
            data-testid="plan-add-spot"
            data-place-name={suggestion.placeName}
          >
            {added ? "Added" : adding ? "Adding…" : "Add"}
          </button>
        </div>
      ) : null}
      <p className="px-3 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
        Past trips at this place
      </p>
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
  added,
  adding,
  onAdd,
}: {
  suggestion: BaitPlanSuggestion;
  showOwner: boolean;
  added: boolean;
  adding: boolean;
  onAdd: () => void;
}) {
  const w = suggestion.window;
  const first = suggestion.matches[0]?.baitSpot;
  const src = first ? personalPhotoSrc(first.photoPath) : null;
  const canAdd = Boolean(suggestion.placeName?.trim());
  if (!first) return null;

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
      {canAdd ? (
        <div className="flex items-center justify-end gap-2 px-3 pb-2">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!added && !adding) onAdd();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            disabled={added || adding}
            aria-label={
              added
                ? `${suggestion.placeName} added to this day`
                : `Add ${suggestion.placeName} to this day`
            }
            className={`rounded-full px-3 py-1 text-xs font-semibold ${TAP_RESET} ${
              added
                ? "bg-teal/15 text-teal"
                : "border border-line bg-card text-teal"
            } disabled:opacity-60`}
            data-testid="plan-add-spot"
            data-place-name={suggestion.placeName}
          >
            {added ? "Added" : adding ? "Adding…" : "Add"}
          </button>
        </div>
      ) : null}
      <p className="px-3 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
        Past trips at this place
      </p>
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
      <span className="max-w-[12rem] shrink-0 rounded-full border-2 border-copper bg-good px-2.5 py-1 text-right text-xs font-bold leading-snug text-white">
        {veryStrongMatchChip(atIso)}
      </span>
    );
  }
  if (strength === "strong") {
    return (
      <span className="shrink-0 rounded-full border-2 border-teal-deep bg-good px-2.5 py-1 text-xs font-bold text-white">
        Strong match
      </span>
    );
  }
  if (strength === "good") {
    return (
      <span className="rounded-full bg-teal px-2 py-0.5 text-[10px] font-semibold text-white">Good match</span>
    );
  }
  return (
    <span className="rounded-full bg-paper-deep px-2 py-0.5 text-[10px] font-semibold text-ink">Lean match</span>
  );
}
