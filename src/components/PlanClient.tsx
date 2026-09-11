"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SharedToggle, sharedQuery, useIncludeShared } from "@/components/BuddyPanel";
import { OwnerShareBadge } from "@/components/OwnerShareBadge";
import { ShareFriendPicker, selectedShareBuddyIds, type ShareFriend } from "@/components/ShareFriendPicker";
import { personalPhotoSrc } from "@/lib/photo";
import { baitTypesLabel } from "@/lib/bait";
import { speciesLabel } from "@/lib/species";
import { PlanDayLabel, PlanDayNotes } from "@/components/CalendarNotes";
import { CHANGES_SAVED_LABEL } from "@/lib/feedback";
import { monthGrid, monthLabel, shiftMonth, todayKey, WEEKDAY_LABELS } from "@/lib/calendar";
import {
  addPlanSpotToDay,
  dayHasPlanSpot,
  groupNotesByDay,
  formatPlanCalendarLabel,
  journalNotesForCalendarLog,
  journalNotesForPlanWriteups,
  labelsByPlanDay,
  labelsForPlannedSpot,
  planDayLabel,
  listedPlanNotes,
  mergeCommittedPlanSpots,
  mergeListedPlanNotes,
  mergePlannedPlacePhotos,
  photosForPlannedPlaces,
  plannedSpotOpenLabel,
  plannedSpotsOnDay,
  planDayAfterSelect,
  planSpotIdentityKey,
  planSpotRemoveTarget,
  preferOwnPlanNotes,
  UNPLAN_SPOT_CONFIRM,
  selectPlanDay,
  planSpotDetailHref,
  planSpotSourceKind,
  restorePlanDay,
  type PlanSpotSource,
} from "@/lib/notes";
import { ownerShareStatusLine, planDayShareState } from "@/lib/sharing";
import {
  PENDING_PLAN_BAIT_QUERY,
  PENDING_PLAN_CATCH_QUERY,
  PENDING_PLAN_PHOTO_QUERY,
  PENDING_PLAN_PLACE_QUERY,
  PENDING_PLAN_SPECIES_QUERY,
  clearPendingPlanDay,
  dropCommittedPlanSpot,
  dropCommittedPlanSpotsForDay,
  parsePendingPlanSpotSearch,
  pendingPlanDayToCommit,
  pendingPlanPrompt,
  pendingPlanSpotFromBait,
  pendingPlanSpotFromCatch,
  planHrefForPendingSpot,
  readCommittedPlanSpots,
  readPendingPlanDay,
  readPendingPlanSpot,
  rememberCommittedPlanSpot,
  resolvePendingPlanSpot,
  writePendingPlanDay,
  type PendingPlanSpot,
} from "@/lib/pending-plan-spot";
import {
  pinForPlannedSpot,
  planDayReferenceAt,
  plannedDayTideDetail,
  catchTideLookupKey,
  catchTideLookupsForSpots,
  catchNeedsPlanTideFetch,
  fallbackChipFromDayTides,
  plannedSpotTideRefreshKey,
  sameTideChipsForSpots,
  type PlannedTidePin,
} from "@/lib/plan-tides";
import { tidesApplyToHabitat, timeZoneFromLongitude, type TideSnapshot } from "@/lib/tides/snapshot";
import {
  parsePlanDate,
  planLookupFailureNote,
  planPlaceToAdd,
  planWhyChips,
  forecastWindowWhenLabel,
  dedupeBaitSuggestionsByPlace,
  dedupeCatchSuggestionsByPlace,
  extraPastTripMatches,
  readLastPlanDay,
  splitBaitSuggestionByPlace,
  splitPlanSuggestionByPlace,
  uniqueNotesByPlace,
  writeLastPlanDay,
} from "@/lib/plan";
import { formatDateOnly, formatWeekdayDate } from "@/lib/time";
import { conditionLabel, veryStrongMatchChip, veryStrongMatchLabel } from "@/lib/similar";
import type {
  BaitPlanSuggestion,
  BaitSpot,
  CalendarNote,
  CalendarNoteInput,
  CatchRecord,
  PlanResult,
  PlanSuggestion,
} from "@/lib/types";

const TAP_RESET =
  "outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-teal";

/** Keep Planned Share/Delete below the iPhone status bar after scrolling the card into view. */
function scrollPlanResultsBelowStatusBar(el: HTMLElement) {
  el.style.scrollMarginTop = "calc(var(--safe-area-top) + 0.75rem)";
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "position:absolute;left:0;top:0;width:0;height:var(--safe-area-top);pointer-events:none;visibility:hidden";
  document.body.appendChild(probe);
  const safeTop = probe.getBoundingClientRect().height;
  probe.remove();
  const top = window.scrollY + el.getBoundingClientRect().top - safeTop - 12;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

function keepFilled<T>(incoming: T, previous: T): T {
  if (incoming == null || incoming === "") return previous;
  return incoming;
}

function mergeRecordById<T extends { id: string }>(current: T[], row: T): T[] {
  const index = current.findIndex((item) => item.id === row.id);
  if (index === -1) return [...current, row];
  const prev = current[index] as T & {
    latitude?: number | null;
    longitude?: number | null;
    photoTakenLatitude?: number | null;
    photoTakenLongitude?: number | null;
    caughtAt?: string | null;
    tide?: string | null;
    tideHeightFt?: number | null;
  };
  const next = [...current];
  const incoming = row as typeof prev;
  next[index] = {
    ...prev,
    ...row,
    latitude: keepFilled(incoming.latitude, prev.latitude),
    longitude: keepFilled(incoming.longitude, prev.longitude),
    photoTakenLatitude: keepFilled(incoming.photoTakenLatitude, prev.photoTakenLatitude),
    photoTakenLongitude: keepFilled(incoming.photoTakenLongitude, prev.photoTakenLongitude),
    caughtAt: keepFilled(incoming.caughtAt, prev.caughtAt),
    tide: keepFilled(incoming.tide, prev.tide),
    tideHeightFt: keepFilled(incoming.tideHeightFt, prev.tideHeightFt),
  } as T;
  return next;
}

function readSessionPendingSpot(): PendingPlanSpot | null {
  if (typeof sessionStorage === "undefined") return null;
  return readPendingPlanSpot(sessionStorage);
}

function sessionStore(): Storage | null {
  return typeof sessionStorage === "undefined" ? null : sessionStorage;
}

export function PlanClient({
  viewerId = "",
  initialDate,
  initialNotes = [],
  initialAddCatch = null,
  initialAddBait = null,
  initialAddPlace = null,
  initialAddSpecies = null,
  initialAddPhoto = null,
}: {
  viewerId?: string;
  initialDate: string | null;
  initialNotes?: CalendarNote[];
  initialAddCatch?: string | null;
  initialAddBait?: string | null;
  initialAddPlace?: string | null;
  initialAddSpecies?: string | null;
  initialAddPhoto?: string | null;
}) {
  const now = new Date();
  const [pendingSpot, setPendingSpot] = useState<PendingPlanSpot | null>(() => {
    const params = new URLSearchParams();
    if (initialAddCatch) params.set(PENDING_PLAN_CATCH_QUERY, initialAddCatch);
    if (initialAddBait) params.set(PENDING_PLAN_BAIT_QUERY, initialAddBait);
    if (initialAddPlace) params.set(PENDING_PLAN_PLACE_QUERY, initialAddPlace);
    if (initialAddSpecies) params.set(PENDING_PLAN_SPECIES_QUERY, initialAddSpecies);
    if (initialAddPhoto) params.set(PENDING_PLAN_PHOTO_QUERY, initialAddPhoto);
    return parsePendingPlanSpotSearch(params);
  });
  const pendingSpotRef = useRef<PendingPlanSpot | null>(pendingSpot);
  pendingSpotRef.current = pendingSpot;
  const committingRef = useRef(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(() => {
    if (pendingSpot || initialAddCatch || initialAddBait || initialAddPlace) return null;
    return parsePlanDate(initialDate) ? initialDate : null;
  });
  const [notes, setNotes] = useState<CalendarNote[]>(() =>
    listedPlanNotes(initialNotes, todayKey()) ?? [],
  );
  const [committedSpots, setCommittedSpots] = useState(() =>
    readCommittedPlanSpots(typeof sessionStorage === "undefined" ? null : sessionStorage),
  );
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
  const [deletingPlan, setDeletingPlan] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [buddies, setBuddies] = useState<ShareFriend[]>([]);
  const [journalCatches, setJournalCatches] = useState<CatchRecord[]>([]);
  const [journalBait, setJournalBait] = useState<BaitSpot[]>([]);
  const [planTides, setPlanTides] = useState<{
    detail: string;
    snap: TideSnapshot | null;
    catchSnaps: Record<string, TideSnapshot | null>;
  }>({ detail: "", snap: null, catchSnaps: {} });
  const resultsRef = useRef<HTMLElement | null>(null);
  const pendingDayRef = useRef<string | null>(null);
  const plannedPhotoCacheRef = useRef<ReturnType<typeof photosForPlannedPlaces>>([]);
  const catchSnapsRef = useRef(planTides.catchSnaps);
  catchSnapsRef.current = planTides.catchSnaps;

  useEffect(() => {
    function onPop() {
      if (pendingSpot) return;
      const date = new URLSearchParams(window.location.search).get("date");
      setSelectedDay(
        restorePlanDay(
          notes,
          todayKey(),
          parsePlanDate(date) ? date : readLastPlanDay(sessionStorage),
        ),
      );
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [notes, pendingSpot]);

  useEffect(() => {
    if (pendingSpot) return;
    if (selectedDay) {
      writeLastPlanDay(selectedDay, sessionStorage);
      return;
    }
    const restored = restorePlanDay(notes, todayKey(), readLastPlanDay(sessionStorage));
    if (restored) setSelectedDay(restored);
  }, [selectedDay, notes, pendingSpot]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromSearch = parsePendingPlanSpotSearch(params);
    const next = resolvePendingPlanSpot(fromSearch, readSessionPendingSpot());
    if (next) setPendingSpot(next);
    const dateFromUrl = params.get("date");
    const picked = pendingPlanDayToCommit(
      fromSearch,
      dateFromUrl,
      readPendingPlanDay(sessionStore()),
    );
    if (picked) pendingDayRef.current = picked;
    // Fresh List / Add to plan has no date= yet — wait for a tap.
    // After a save we keep the spot and replaceState to /plan?date=…; do not wipe that day.
    else if (next && !(dateFromUrl && /^\d{4}-\d{2}-\d{2}$/.test(dateFromUrl))) {
      setSelectedDay(null);
    }
    setCommittedSpots(readCommittedPlanSpots(sessionStore()));
  }, [initialAddCatch, initialAddBait, initialAddPlace]);

  useEffect(() => {
    const catchId = pendingSpot?.catchId;
    const baitId = pendingSpot?.baitId;
    if (!catchId && !baitId) return;
    if (pendingSpot?.placeName && pendingSpot?.photoPath) return;
    let cancelled = false;
    const url = catchId ? `/api/catches/${catchId}` : `/api/bait-spots/${baitId}`;
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const fetched = catchId
          ? pendingPlanSpotFromCatch(data.catch ?? {})
          : pendingPlanSpotFromBait(data.spot ?? {});
        if (catchId && data.catch?.id) {
          setJournalCatches((current) => mergeRecordById(current, data.catch as CatchRecord));
        }
        if (baitId && data.spot?.id) {
          setJournalBait((current) => mergeRecordById(current, data.spot as BaitSpot));
        }
        if (!fetched) return;
        setPendingSpot((current) => {
          if (!current) return fetched;
          if (catchId && current.catchId !== catchId) return current;
          if (baitId && current.baitId !== baitId) return current;
          const photoPath = current.photoPath || fetched.photoPath;
          return {
            ...current,
            placeName: current.placeName || fetched.placeName,
            speciesTargets: current.speciesTargets.length
              ? current.speciesTargets
              : fetched.speciesTargets,
            ...(photoPath ? { photoPath } : {}),
          };
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pendingSpot?.catchId, pendingSpot?.baitId, pendingSpot?.placeName, pendingSpot?.photoPath]);

  useEffect(() => {
    fetch("/api/buddies")
      .then((r) => r.json())
      .then((data) =>
        setBuddies(
          ((data.buddies ?? []) as { id?: string; name?: string }[])
            .filter((buddy): buddy is ShareFriend => Boolean(buddy.id && buddy.name)),
        ),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const today = todayKey();
    fetch(`/api/calendar-notes?for=plan&today=${today}&includeShared=1`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const listed = Array.isArray(data?.notes) ? (data.notes as CalendarNote[]) : null;
        if (listed == null) return;
        setNotes((current) => mergeListedPlanNotes(current, listed, today));
        if (Array.isArray(data?.catches)) {
          setJournalCatches((current) =>
            (data.catches as CatchRecord[]).reduce(mergeRecordById, current),
          );
        }
        if (Array.isArray(data?.spots)) {
          setJournalBait((current) => (data.spots as BaitSpot[]).reduce(mergeRecordById, current));
        }
        setSelectedDay((current) => {
          if (current || pendingSpot) return current;
          return restorePlanDay(listed, today, readLastPlanDay(sessionStorage));
        });
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
    if (data.note) {
      setNotes((current) => [...current, data.note]);
      if (data.note.kind === "plan-spot" && data.note.placeName) {
        const committed = {
          day: data.note.day,
          placeName: data.note.placeName,
          sourceCatchId: data.note.sourceCatchId,
          sourceBaitId: data.note.sourceBaitId,
          photoPath: data.note.photoPath,
          speciesTargets: data.note.speciesTargets,
          savedAt: Date.now(),
        };
        rememberCommittedPlanSpot(
          typeof sessionStorage === "undefined" ? null : sessionStorage,
          committed,
        );
        setCommittedSpots((current) => [
          ...current.filter(
            (item) =>
              item.day !== committed.day ||
              planSpotIdentityKey(item) !== planSpotIdentityKey(committed),
          ),
          committed,
        ]);
      }
    }
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

  async function onRemovePlanSpot(note: CalendarNote) {
    if (viewerId && note.anglerId && note.anglerId !== viewerId) return;
    const target = planSpotRemoveTarget(note);
    if (!target) return;
    if (!confirm(UNPLAN_SPOT_CONFIRM)) return;
    try {
      if (target.calendarNoteId) {
        const res = await fetch(`/api/calendar-notes/${target.calendarNoteId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("remove failed");
      }
      setNotes((current) => current.filter((row) => row.id !== note.id));
      setCommittedSpots((current) =>
        current.filter(
          (item) =>
            item.day !== note.day || planSpotIdentityKey(item) !== planSpotIdentityKey(note),
        ),
      );
      dropCommittedPlanSpot(sessionStore(), note);
    } catch {
      setAddError("Could not remove that spot from the plan.");
    }
  }

  async function onDeletePlan() {
    if (!selectedDay || viewingFriendPlan) return;
    if (!confirm("Delete this plan?")) return;
    setDeletingPlan(true);
    setAddError(null);
    try {
      const res = await fetch(`/api/calendar-notes?day=${selectedDay}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      const day = selectedDay;
      setNotes((current) => current.filter((n) => n.day !== day));
      setCommittedSpots((current) => current.filter((spot) => spot.day !== day));
      dropCommittedPlanSpotsForDay(
        typeof sessionStorage === "undefined" ? null : sessionStorage,
        day,
      );
      setSpotSaved(false);
    } catch {
      setAddError("Could not delete this plan.");
    } finally {
      setDeletingPlan(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const q = sharedQuery(includeShared);
    const suffix = q ? `?${q}` : "";
    fetch(`/api/catches${suffix}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.catches)) setJournalCatches(data.catches);
      })
      .catch(() => {});
    fetch(`/api/bait-spots${suffix}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.spots)) setJournalBait(data.spots);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [includeShared]);

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
        const extra = (data.suggestions ?? []).flatMap((row) =>
          (row.matches ?? []).map((match) => match.catch).filter(Boolean),
        );
        if (extra.length) {
          setJournalCatches((current) => extra.reduce(mergeRecordById, current));
        }
      })
      .catch(() => {
        setError("Could not build a plan.");
        setPlan(null);
      });
  }, [selectedDay, includeShared]);

  useEffect(() => {
    if (!selectedDay || !plan || !resultsRef.current) return;
    scrollPlanResultsBelowStatusBar(resultsRef.current);
  }, [selectedDay, plan]);

  const suggestions = dedupeCatchSuggestionsByPlace(
    (plan?.suggestions ?? []).flatMap(splitPlanSuggestionByPlace),
  );
  const baitSuggestions = dedupeBaitSuggestionsByPlace(
    (plan?.baitSuggestions ?? []).flatMap(splitBaitSuggestionByPlace),
  );
  const lookupFailure = planLookupFailureNote(plan?.note);
  const visibleNotes = preferOwnPlanNotes(
    mergeCommittedPlanSpots(notes, committedSpots),
    viewerId,
  );
  const notesByDay = groupNotesByDay(visibleNotes);
  const notedDays = new Set(notesByDay.keys());
  const selectedNotes = selectedDay ? (notesByDay.get(selectedDay) ?? []) : [];
  const journalNotes = journalNotesForCalendarLog(selectedNotes);
  const writeupNotes = journalNotesForPlanWriteups(selectedNotes);
  const dayLabels = labelsByPlanDay(visibleNotes);
  const spotsOnDay = uniqueNotesByPlace(plannedSpotsOnDay(selectedNotes));
  const viewingFriendPlan = Boolean(
    viewerId && selectedNotes.some((note) => note.anglerId && note.anglerId !== viewerId),
  );
  const isPlanOwner = Boolean(viewerId && selectedNotes.length && !viewingFriendPlan);
  const shareState = planDayShareState(selectedNotes);
  const planShared = shareState.sharedWithLinked || shareState.sharedWithBuddyIds.length > 0;
  const friendOwnerName =
    selectedNotes.find((note) => note.ownerName?.trim())?.ownerName?.trim() ?? "";
  const tideJournal = { catches: journalCatches, baitSpots: journalBait };
  const stationPin =
    spotsOnDay
      .map((note) => pinForPlannedSpot(note, tideJournal))
      .find((pin): pin is PlannedTidePin => Boolean(pin)) ?? null;
  const stationKey = stationPin
    ? `${stationPin.latitude.toFixed(4)},${stationPin.longitude.toFixed(4)}`
    : "";
  const tideRefreshKey = plannedSpotTideRefreshKey(spotsOnDay, tideJournal, stationPin);
  const plannedCatchIds = spotsOnDay
    .map((note) => note.sourceCatchId?.trim())
    .filter((id): id is string => Boolean(id));

  useEffect(() => {
    const missing = plannedCatchIds.filter((id) =>
      catchNeedsPlanTideFetch(journalCatches.find((item) => item.id === id)),
    );
    if (!missing.length) return;
    let cancelled = false;
    void Promise.all(
      missing.map(async (id) => {
        try {
          const res = await fetch(`/api/catches/${id}`, { cache: "no-store" });
          const data = res.ok ? await res.json() : null;
          return data?.catch ?? null;
        } catch {
          return null;
        }
      }),
    ).then((rows) => {
      if (cancelled) return;
      const extra = rows.filter((row): row is CatchRecord => Boolean(row?.id));
      if (!extra.length) return;
      setJournalCatches((current) => extra.reduce(mergeRecordById, current));
    });
    return () => {
      cancelled = true;
    };
  }, [plannedCatchIds.join(","), journalCatches]);

  useEffect(() => {
    if (!selectedDay || !spotsOnDay.length) {
      setPlanTides((current) =>
        current.snap || current.detail
          ? { detail: "", snap: null, catchSnaps: current.catchSnaps }
          : current,
      );
      return;
    }
    if (!stationPin) return;
    let cancelled = false;
    const day = selectedDay;
    const pin = stationPin;
    const at = planDayReferenceAt(day, null);
    if (!at) return;
    void (async () => {
      let snap: TideSnapshot | null = null;
      try {
        const res = await fetch("/api/assist/weather", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: pin.latitude,
            longitude: pin.longitude,
            at: at.toISOString(),
            habitat: tidesApplyToHabitat(pin.habitat) ? pin.habitat : "saltwater-inshore",
          }),
        });
        const data = res.ok ? await res.json() : null;
        snap = (data?.tide as TideSnapshot | undefined) ?? null;
      } catch {
        snap = null;
      }
      if (cancelled || !snap) return;
      const detail = plannedDayTideDetail(snap, pin.longitude);
      setPlanTides((current) => ({ ...current, detail, snap }));
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDay, stationKey]);

  useEffect(() => {
    if (!selectedDay || !spotsOnDay.length) return;
    const lookups = catchTideLookupsForSpots(spotsOnDay, tideJournal, stationPin);
    const missing = [...lookups.entries()].filter(
      ([key, row]) => Boolean(catchTideLookupKey(row)) && !(key in catchSnapsRef.current),
    );
    if (!missing.length) return;
    let cancelled = false;
    void Promise.all(
      missing.map(async ([key, row]) => {
        try {
          const res = await fetch("/api/assist/weather", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: row.latitude,
              longitude: row.longitude,
              at: row.caughtAt,
              habitat: tidesApplyToHabitat(row.habitat) ? row.habitat : "saltwater-inshore",
            }),
          });
          const data = res.ok ? await res.json() : null;
          return [key, (data?.tide as TideSnapshot | undefined) ?? null] as const;
        } catch {
          return [key, null] as const;
        }
      }),
    ).then((rows) => {
      if (cancelled) return;
      setPlanTides((current) => {
        const catchSnaps = { ...current.catchSnaps };
        let changed = false;
        for (const [key, snap] of rows) {
          if (catchSnaps[key] !== snap) {
            catchSnaps[key] = snap;
            changed = true;
          }
        }
        return changed ? { ...current, catchSnaps } : current;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDay, tideRefreshKey]);
  const sameTideById =
    selectedDay && planTides.snap
      ? sameTideChipsForSpots(
          spotsOnDay,
          planTides.snap,
          selectedDay,
          { catches: journalCatches, baitSpots: journalBait },
          planTides.catchSnaps,
        )
      : {};
  const freshPlannedPhotos = photosForPlannedPlaces(spotsOnDay, suggestions, baitSuggestions, {
    catches: journalCatches,
    baitSpots: journalBait,
  });
  const plannedPhotos = mergePlannedPlacePhotos(
    spotsOnDay,
    freshPlannedPhotos,
    plannedPhotoCacheRef.current,
  );
  if (freshPlannedPhotos.length) plannedPhotoCacheRef.current = plannedPhotos;

  async function onSharePlan(shared: boolean, buddyIds?: string[]) {
    if (!selectedDay || !isPlanOwner) return;
    setShareBusy(true);
    setShareError(null);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planDay: selectedDay,
          shared,
          ...(buddyIds ? { buddyIds } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { updated?: number };
      if (!res.ok || data.updated === 0) {
        setShareError("Could not update sharing.");
        return;
      }
      const day = selectedDay;
      setNotes((current) =>
        current.map((note) =>
          note.day === day && note.anglerId === viewerId
            ? {
                ...note,
                sharedWithLinked: shared && !buddyIds,
                sharedWithBuddyIds: shared ? (buddyIds ?? []) : [],
              }
            : note,
        ),
      );
    } catch {
      setShareError("Could not update sharing.");
    } finally {
      setShareBusy(false);
    }
  }

  async function onAddSpot(spot: PlanSpotSource, day = selectedDay) {
    if (!day || viewingFriendPlan) return;
    const dayNotes = notesByDay.get(day) ?? [];
    const input = addPlanSpotToDay(dayNotes, day, spot);
    if (!input?.placeName) return;
    const catchId = spot.sourceCatchId?.trim();
    const baitId = spot.sourceBaitId?.trim();
    if (catchId) {
      void fetch(`/api/catches/${catchId}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.catch?.id) {
            setJournalCatches((current) => mergeRecordById(current, data.catch as CatchRecord));
          }
        })
        .catch(() => {});
    }
    if (baitId) {
      void fetch(`/api/bait-spots/${baitId}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.spot?.id) {
            setJournalBait((current) => mergeRecordById(current, data.spot as BaitSpot));
          }
        })
        .catch(() => {});
    }
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

  async function commitPendingSpot(day: string) {
    const spot = pendingSpotRef.current;
    if (!spot?.placeName) {
      pendingDayRef.current = day;
      writePendingPlanDay(sessionStore(), day);
      return;
    }
    if (committingRef.current) return;
    committingRef.current = true;
    pendingDayRef.current = null;
    const dayNotes = notesByDay.get(day) ?? [];
    const input = addPlanSpotToDay(dayNotes, day, spot);
    try {
      if (input?.placeName) {
        await onAddSpot(spot, day);
      }
      // Keep the List / Add to plan spot so the next calendar tap can save another day.
      setSelectedDay(day);
      writeLastPlanDay(day, sessionStore());
      const parsed = parsePlanDate(day);
      if (parsed) {
        setYear(parsed.getFullYear());
        setMonth(parsed.getMonth());
      }
      clearPendingPlanDay(sessionStore());
      window.history.replaceState(null, "", `/plan?date=${day}`);
    } finally {
      committingRef.current = false;
    }
  }

  useEffect(() => {
    const day = pendingDayRef.current;
    if (!day || !pendingSpot?.placeName) return;
    void commitPendingSpot(day);
  }, [pendingSpot]);

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
        {pendingPlanPrompt(pendingSpot) ? (
          <p data-testid="plan-pending-spot" className="pt-1 text-sm font-semibold text-teal">
            {pendingPlanPrompt(pendingSpot)}
          </p>
        ) : null}
      </div>

      <PlanDayCalendar
        year={year}
        month={month}
        selectedDay={selectedDay}
        notedDays={notedDays}
        dayLabels={dayLabels}
        onMonthChange={(next) => {
          setYear(next.year);
          setMonth(next.month);
        }}
        onSelectDay={(date) => {
          const day = selectPlanDay(date);
          if (!day) return;
          const picked = planDayAfterSelect(notes, day);
          if (!picked) return;
          setSelectedDay(picked.day);
          writeLastPlanDay(picked.day, typeof sessionStorage === "undefined" ? null : sessionStorage);
          const parsed = parsePlanDate(picked.day);
          if (parsed) {
            setYear(parsed.getFullYear());
            setMonth(parsed.getMonth());
          }
          setSpotSaved(false);
          setAddError(null);
          setDeletingPlan(false);
          const pending = pendingSpotRef.current;
          if (pending) {
            writePendingPlanDay(
              typeof sessionStorage === "undefined" ? null : sessionStorage,
              picked.day,
            );
            window.history.pushState(null, "", planHrefForPendingSpot(pending, picked.day));
            void commitPendingSpot(picked.day);
          } else {
            window.history.pushState(null, "", `/plan?date=${picked.day}`);
          }
        }}
      />

      {!selectedDay ? (
        <p className="on-wash-chip text-sm">
          {pendingPlanPrompt(pendingSpot) ?? "Tap a day to plan it."}
        </p>
      ) : (
          <section
            ref={resultsRef}
            className="plan-day-results min-w-0 overflow-visible space-y-3"
            data-testid="plan-day-results"
          >
          <section
            className="journal-card min-w-0 overflow-visible space-y-3 rounded-2xl border-2 border-teal/45 p-3"
            data-testid="plan-planned"
          >
            <div className="plan-planned-header flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-start gap-2">
                  <h3 className="font-display text-xl text-teal">Planned</h3>
                  {isPlanOwner ? (
                    <OwnerShareBadge
                      sharedWithLinked={shareState.sharedWithLinked}
                      sharedWithBuddyIds={shareState.sharedWithBuddyIds}
                      friends={buddies}
                    />
                  ) : null}
                </div>
                <p className="text-sm text-ink-muted">{formatWeekdayDate(selectedDay)}</p>
                {viewingFriendPlan && friendOwnerName ? (
                  <p className="pt-1 text-xs font-semibold text-copper" data-testid="plan-shared-by">
                    Shared by {friendOwnerName}
                  </p>
                ) : null}
                {planTides.detail ? (
                  <p data-testid="plan-day-tides" className="pt-1 text-sm font-semibold text-teal">
                    {planTides.detail}
                  </p>
                ) : null}
              </div>
              {selectedNotes.length && !viewingFriendPlan ? (
                <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
                  {isPlanOwner ? (
                    <button
                      type="button"
                      disabled={shareBusy}
                      aria-pressed={planShared}
                      data-testid="plan-share"
                      onClick={() => void onSharePlan(!planShared)}
                      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                        planShared
                          ? "border-2 border-teal bg-teal/15 text-teal"
                          : "bg-teal text-white"
                      } disabled:opacity-50`}
                    >
                      {shareState.sharedWithLinked ? "Shared" : "Share"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void onDeletePlan()}
                    disabled={deletingPlan}
                    className="rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-copper disabled:opacity-60"
                    data-testid="plan-delete-day"
                  >
                    {deletingPlan ? "Deleting…" : "Delete plan"}
                  </button>
                </div>
              ) : null}
            </div>
            {isPlanOwner ? (
              <div data-testid="plan-share-block">
                <p className="text-xs text-ink-muted" data-testid="owner-share-status">
                  {ownerShareStatusLine({
                    sharedWithLinked: shareState.sharedWithLinked,
                    sharedWithBuddyIds: shareState.sharedWithBuddyIds,
                    friends: buddies,
                  })}
                </p>
                <p className="text-xs text-ink-muted">Pick who sees this plan. Off until you choose.</p>
                <ShareFriendPicker
                  buddies={buddies}
                  disabled={shareBusy}
                  selectedIds={selectedShareBuddyIds({
                    sharedWithLinked: shareState.sharedWithLinked,
                    sharedWithBuddyIds: shareState.sharedWithBuddyIds,
                    buddyIds: buddies.map((buddy) => buddy.id),
                  })}
                  onChange={(ids) => {
                    if (!ids.length) void onSharePlan(false);
                    else if (ids.length === buddies.length) void onSharePlan(true);
                    else void onSharePlan(true, ids);
                  }}
                />
                {shareError ? <p className="mt-1 text-xs text-copper">{shareError}</p> : null}
              </div>
            ) : null}
            {spotSaved ? (
              <p data-testid="changes-saved" className="text-sm font-semibold text-teal">
                {CHANGES_SAVED_LABEL}
              </p>
            ) : null}
            {addError ? <p className="text-sm text-copper">{addError}</p> : null}
            {spotsOnDay.length ? (
              <div data-testid="plan-day-spots">
                <ul className="flex flex-col gap-2" data-testid="plan-planned-photos">
                  {spotsOnDay.map((note) => {
                    const photo = plannedPhotos.find((item) => item.id === note.id);
                    const kind = planSpotSourceKind(note);
                    const href = planSpotDetailHref(note, photo);
                    const labels = labelsForPlannedSpot(note, {
                      catches: journalCatches,
                      baitSpots: journalBait,
                    });
                    const rowPin = pinForPlannedSpot(note, tideJournal, stationPin);
                    const closestTide =
                      sameTideById[note.id] ||
                      fallbackChipFromDayTides(
                        planTides.snap,
                        selectedDay,
                        timeZoneFromLongitude(rowPin?.longitude ?? stationPin?.longitude),
                        rowPin?.tide,
                      );
                    const row = (
                      <>
                        {photo ? (
                          <span className="block shrink-0 overflow-hidden rounded-xl">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photo.src}
                              alt=""
                              className="h-16 w-16 object-cover"
                              data-testid="plan-planned-photo"
                            />
                          </span>
                        ) : null}
                        <span className="flex min-w-0 items-start gap-2">
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded-full bg-teal/15 px-2.5 py-1 text-xs font-semibold text-teal">
                                {note.placeName}
                              </span>
                              {kind === "bait" ? (
                                <span className="rounded-full bg-copper/15 px-2 py-0.5 text-[10px] font-semibold text-copper">
                                  Bait
                                </span>
                              ) : null}
                            </span>
                            {labels.fish.length || labels.bait.length ? (
                              <span className="mt-1 flex flex-wrap gap-1">
                                {labels.fish.map((name) => (
                                  <span
                                    key={`fish:${name}`}
                                    className="rounded-full bg-teal/10 px-2 py-0.5 text-[10px] font-semibold text-teal"
                                    data-testid="plan-day-spot-fish"
                                  >
                                    {name}
                                  </span>
                                ))}
                                {labels.bait.map((name) => (
                                  <span
                                    key={`bait:${name}`}
                                    className="rounded-full bg-copper/15 px-2 py-0.5 text-[10px] font-semibold text-copper"
                                    data-testid="plan-day-spot-bait"
                                  >
                                    {name}
                                  </span>
                                ))}
                              </span>
                            ) : null}
                          </span>
                          {closestTide ? (
                            <span className="flex shrink-0 flex-col items-start gap-0.5">
                              <span
                                className="text-xs text-ink-muted"
                                data-testid="plan-day-spot-tide-label"
                              >
                                matching tide
                              </span>
                              <span
                                className="rounded-full bg-paper-deep px-2 py-0.5 text-[10px] font-semibold text-ink"
                                data-testid="plan-day-spot-tide"
                              >
                                {closestTide}
                              </span>
                            </span>
                          ) : null}
                        </span>
                      </>
                    );
                    return (
                      <li
                        key={note.id}
                        className="flex items-start gap-2"
                        data-testid="plan-day-spot"
                        data-plan-source={kind}
                      >
                        {href && !viewingFriendPlan ? (
                          <Link
                            href={href}
                            className={`flex min-w-0 flex-1 items-center gap-2 ${TAP_RESET}`}
                            aria-label={plannedSpotOpenLabel(note.placeName, kind, labels)}
                            data-testid="plan-day-spot-open"
                          >
                            {row}
                          </Link>
                        ) : (
                          <div className="flex min-w-0 flex-1 items-center gap-2">{row}</div>
                        )}
                        {viewingFriendPlan ? null : (
                          <button
                            type="button"
                            onClick={() => void onRemovePlanSpot(note)}
                            className="shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold text-copper"
                            data-testid="plan-day-spot-remove"
                          >
                            Remove
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            {!spotsOnDay.length && !writeupNotes.length && !plannedPhotos.length && !planDayLabel(selectedNotes) ? (
              <p className="text-sm text-ink-muted">
                Nothing planned yet. Add a place below, a day label, or write a note.
              </p>
            ) : null}
            <PlanDayLabel
              key={`${selectedDay}-label`}
              day={selectedDay}
              notes={journalNotes}
              readOnly={viewingFriendPlan}
              onCreate={onCreateNote}
              onUpdate={onUpdateNote}
              onDelete={onDeleteNote}
            />
            <PlanDayNotes
              key={selectedDay}
              day={selectedDay}
              notes={writeupNotes}
              embedded
              readOnly={viewingFriendPlan}
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
                  allowAdd={!viewingFriendPlan}
                  added={dayHasPlanSpot(selectedNotes, s.placeName, {
                    sourceCatchId: s.matches[0]?.catch.id,
                  })}
                  adding={addingSpotId === s.placeName}
                  plannedPlaceNames={spotsOnDay.map((note) => note.placeName)}
                  onAdd={() => {
                    const spot = planPlaceToAdd(s);
                    if (!spot) return;
                    const photoMatch =
                      s.matches.find((m) => m.catch.photoPath) ?? s.matches[0];
                    void onAddSpot({
                      ...spot,
                      sourceCatchId: photoMatch?.catch.id,
                      photoPath: photoMatch?.catch.photoPath,
                    });
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
                      allowAdd={!viewingFriendPlan}
                      added={dayHasPlanSpot(selectedNotes, s.placeName, {
                        sourceBaitId: s.matches[0]?.baitSpot.id,
                      })}
                      adding={addingSpotId === s.placeName}
                      plannedPlaceNames={spotsOnDay.map((note) => note.placeName)}
                      onAdd={() =>
                        void onAddSpot({
                          placeName: s.placeName,
                          sourceBaitId: s.matches[0]?.baitSpot.id,
                          photoPath: s.matches[0]?.baitSpot.photoPath,
                          speciesTargets:
                            s.matches[0]?.baitSpot.baitTypes?.length
                              ? s.matches[0].baitSpot.baitTypes
                              : s.baitTypes,
                        })
                      }
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
  dayLabels,
  onMonthChange,
  onSelectDay,
}: {
  year: number;
  month: number;
  selectedDay: string | null;
  notedDays: Set<string>;
  dayLabels: Map<string, string>;
  onMonthChange: (next: { year: number; month: number }) => void;
  onSelectDay: (date: string) => void;
}) {
  const cells = monthGrid(year, month);
  const today = todayKey();
  return (
    <section
      className="journal-card overflow-visible rounded-2xl px-3 py-3"
      data-testid="plan-day-calendar"
      data-no-tab-swipe
    >
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
      <div className="mt-1 grid grid-cols-7 gap-1 overflow-visible p-0.5">
        {cells.map((cell) => {
          const isSelected = selectedDay === cell.date;
          const isToday = cell.date === today;
          const hasNote = notedDays.has(cell.date);
          const label = formatPlanCalendarLabel(dayLabels.get(cell.date));
          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => onSelectDay(cell.date)}
              aria-label={
                label
                  ? `${cell.date}, ${dayLabels.get(cell.date)}`
                  : hasNote
                    ? `${cell.date}, has notes`
                    : cell.date
              }
              aria-current={isSelected ? "date" : undefined}
              data-testid={`plan-day-${cell.date}`}
              className={`box-border flex min-h-14 w-full flex-col items-center justify-center overflow-visible rounded-xl border-2 py-1.5 text-sm ${TAP_RESET} ${
                isSelected
                  ? "border-teal bg-card font-semibold"
                  : isToday
                    ? "border-copper bg-card"
                    : "border-transparent bg-card"
              } ${cell.inMonth ? "" : "opacity-35"}`}
            >
              {cell.day}
              {label ? (
                <span
                  className={`mt-0.5 max-w-full truncate px-0.5 text-[8px] leading-tight ${
                    isSelected ? "text-teal" : "text-copper"
                  }`}
                  data-testid="plan-day-label"
                >
                  {label}
                </span>
              ) : null}
              {hasNote ? (
                <span
                  className={`mt-0.5 h-1.5 w-1.5 rounded-full ${isSelected ? "bg-teal" : "bg-copper"}`}
                  data-testid="plan-day-has-note"
                />
              ) : (
                <span className="mt-0.5 h-1.5 w-1.5" />
              )}
            </button>
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
  plannedPlaceNames = [],
  allowAdd = true,
  onAdd,
}: {
  suggestion: PlanSuggestion;
  showOwner: boolean;
  added: boolean;
  adding: boolean;
  plannedPlaceNames?: Array<string | null | undefined>;
  allowAdd?: boolean;
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
    placeName: m.catch.placeName,
  }));
  const primary = matchPhotos[0];
  if (!primary) return null;
  const extraTrips = extraPastTripMatches(matchPhotos, {
    cardPlaceName: suggestion.placeName,
    plannedPlaceNames,
    placeOf: (row) => row.placeName,
  });

  const canAdd = allowAdd && Boolean(suggestion.placeName?.trim());

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
      {extraTrips.length ? (
      <p className="px-3 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
        Past trips at this place
      </p>
      ) : null}
      {extraTrips.length ? (
      <ul className="space-y-2 px-3 py-3">
        {extraTrips.map((m) => (
          <li key={m.id}>
            <Link
              href={`/catch/${m.id}`}
              className={`flex gap-2 ${TAP_RESET}`}
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
          </li>
        ))}
      </ul>
      ) : null}
    </article>
  );
}

function BaitSuggestionCard({
  suggestion,
  showOwner,
  added,
  adding,
  plannedPlaceNames = [],
  allowAdd = true,
  onAdd,
}: {
  suggestion: BaitPlanSuggestion;
  showOwner: boolean;
  added: boolean;
  adding: boolean;
  plannedPlaceNames?: Array<string | null | undefined>;
  allowAdd?: boolean;
  onAdd: () => void;
}) {
  const w = suggestion.window;
  const first = suggestion.matches[0]?.baitSpot;
  const src = first ? personalPhotoSrc(first.photoPath) : null;
  const canAdd = allowAdd && Boolean(suggestion.placeName?.trim());
  const extraTrips = extraPastTripMatches(suggestion.matches, {
    cardPlaceName: suggestion.placeName,
    plannedPlaceNames,
    placeOf: (match) => match.baitSpot.placeName,
  });
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
          {src ? (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-paper-deep">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" data-testid="plan-bait-photo" />
            </div>
          ) : null}
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
      {extraTrips.length ? (
      <p className="px-3 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
        Past trips at this place
      </p>
      ) : null}
      {extraTrips.length ? (
      <ul className="space-y-2 px-3 py-3">
        {extraTrips.map((m) => {
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
                ) : null}
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
      ) : null}
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
