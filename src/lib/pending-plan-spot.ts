import {
  normalizeNotePlace,
  parseSpeciesTargets,
  planSpotSourceKind,
  type CommittedPlanSpot,
} from "./notes";

export const PENDING_PLAN_SPOT_STORAGE_KEY = "tide-mark-pending-plan-spot";
export const PENDING_PLAN_CATCH_QUERY = "addCatch";
export const PENDING_PLAN_BAIT_QUERY = "addBait";
export const PENDING_PLAN_PLACE_QUERY = "addPlace";
export const PENDING_PLAN_SPECIES_QUERY = "addSpecies";
export const PENDING_PLAN_PHOTO_QUERY = "addPhoto";
export const PENDING_PLAN_DAY_STORAGE_KEY = "tide-mark-pending-plan-day";
export const COMMITTED_PLAN_SPOTS_STORAGE_KEY = "tide-mark-committed-plan-spots";
export const COMMITTED_PLAN_SPOT_TTL_MS = 10 * 60 * 1000;

/** Drop an abandoned handoff after this long so a later Plan visit stays clean. */
export const PENDING_PLAN_SPOT_TTL_MS = 2 * 60 * 60 * 1000;

export type PendingPlanSpot = {
  catchId?: string;
  baitId?: string;
  placeName: string;
  speciesTargets: string[];
  photoPath?: string;
  savedAt?: number;
};

function trimPlace(value?: string | null): string {
  return value?.trim() ?? "";
}

/** Place + species from a journal catch. No place means nothing to add on Plan. */
export function pendingPlanSpotFromCatch(record: {
  id?: string;
  placeName?: string | null;
  species?: string | null;
  speciesList?: string[] | null;
  photoPath?: string | null;
}): PendingPlanSpot | null {
  const placeName = trimPlace(record.placeName);
  if (!placeName) return null;
  const names = record.speciesList?.length
    ? record.speciesList
    : record.species
      ? [record.species]
      : [];
  const photoPath = record.photoPath?.trim();
  return {
    catchId: record.id,
    placeName,
    speciesTargets: parseSpeciesTargets(names),
    ...(photoPath ? { photoPath } : {}),
  };
}

/** Place from a bait hole. Same Plan-day add as a catch place. */
export function pendingPlanSpotFromBait(spot: {
  id?: string;
  placeName?: string | null;
  baitTypes?: string[] | null;
  photoPath?: string | null;
}): PendingPlanSpot | null {
  const placeName = trimPlace(spot.placeName);
  if (!placeName) return null;
  const photoPath = spot.photoPath?.trim();
  return {
    baitId: spot.id,
    placeName,
    speciesTargets: parseSpeciesTargets(spot.baitTypes),
    ...(photoPath ? { photoPath } : {}),
  };
}

export function planHrefForPendingSpot(spot: PendingPlanSpot, day?: string | null): string {
  const params = new URLSearchParams();
  if (spot.catchId?.trim()) {
    params.set(PENDING_PLAN_CATCH_QUERY, spot.catchId.trim());
  } else if (spot.baitId?.trim()) {
    params.set(PENDING_PLAN_BAIT_QUERY, spot.baitId.trim());
  }
  if (spot.placeName) params.set(PENDING_PLAN_PLACE_QUERY, spot.placeName);
  if (spot.speciesTargets.length) {
    params.set(PENDING_PLAN_SPECIES_QUERY, spot.speciesTargets.join(","));
  }
  if (spot.photoPath?.trim()) params.set(PENDING_PLAN_PHOTO_QUERY, spot.photoPath.trim());
  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) params.set("date", day);
  return `/plan?${params.toString()}`;
}

export function parsePendingPlanSpotSearch(search: {
  get(name: string): string | null;
}): PendingPlanSpot | null {
  const catchId = search.get(PENDING_PLAN_CATCH_QUERY)?.trim() || undefined;
  const baitId = search.get(PENDING_PLAN_BAIT_QUERY)?.trim() || undefined;
  const placeName = trimPlace(search.get(PENDING_PLAN_PLACE_QUERY));
  const speciesRaw = search.get(PENDING_PLAN_SPECIES_QUERY);
  const speciesTargets = speciesRaw ? parseSpeciesTargets(speciesRaw.split(",")) : [];
  const photoPath = search.get(PENDING_PLAN_PHOTO_QUERY)?.trim() || undefined;
  const photo = photoPath ? { photoPath } : {};
  if (catchId) {
    return { catchId, placeName, speciesTargets, ...photo };
  }
  if (baitId) {
    return { baitId, placeName, speciesTargets, ...photo };
  }
  if (placeName) {
    return { placeName, speciesTargets, ...photo };
  }
  return null;
}

export function writePendingPlanSpot(
  storage: Pick<Storage, "setItem"> | null | undefined,
  spot: PendingPlanSpot,
): void {
  if (!storage) return;
  try {
    storage.setItem(
      PENDING_PLAN_SPOT_STORAGE_KEY,
      JSON.stringify({ ...spot, savedAt: Date.now() }),
    );
  } catch {
    /* private mode */
  }
}

export function readPendingPlanSpot(
  storage: Pick<Storage, "getItem"> | null | undefined,
  now = Date.now(),
): PendingPlanSpot | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PENDING_PLAN_SPOT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingPlanSpot>;
    const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : undefined;
    if (savedAt != null && now - savedAt > PENDING_PLAN_SPOT_TTL_MS) return null;
    const catchId = typeof parsed.catchId === "string" ? parsed.catchId.trim() : "";
    const baitId = typeof parsed.baitId === "string" ? parsed.baitId.trim() : "";
    const placeName = typeof parsed.placeName === "string" ? parsed.placeName.trim() : "";
    const photoPath = typeof parsed.photoPath === "string" ? parsed.photoPath.trim() : "";
    if (!catchId && !baitId && !placeName) return null;
    return {
      catchId: catchId || undefined,
      baitId: baitId || undefined,
      placeName,
      speciesTargets: parseSpeciesTargets(parsed.speciesTargets),
      ...(photoPath ? { photoPath } : {}),
      savedAt,
    };
  } catch {
    return null;
  }
}

export function clearPendingPlanSpot(storage: Pick<Storage, "removeItem"> | null | undefined): void {
  if (!storage) return;
  try {
    storage.removeItem(PENDING_PLAN_SPOT_STORAGE_KEY);
    storage.removeItem(PENDING_PLAN_DAY_STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

export function rememberCommittedPlanSpot(
  storage: Pick<Storage, "getItem" | "setItem"> | null | undefined,
  spot: CommittedPlanSpot,
): void {
  if (!storage || !spot.placeName.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(spot.day)) return;
  const next = [
    ...readCommittedPlanSpots(storage).filter((item) => {
      if (item.day !== spot.day) return true;
      if (normalizeNotePlace(item.placeName) !== normalizeNotePlace(spot.placeName)) return true;
      return planSpotSourceKind(item) !== planSpotSourceKind(spot);
    }),
    { ...spot, savedAt: spot.savedAt ?? Date.now() },
  ].slice(-12);
  try {
    storage.setItem(COMMITTED_PLAN_SPOTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
}

export function readCommittedPlanSpots(
  storage: Pick<Storage, "getItem"> | null | undefined,
  now = Date.now(),
): CommittedPlanSpot[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(COMMITTED_PLAN_SPOTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Partial<CommittedPlanSpot>;
      const day = typeof row.day === "string" ? row.day.trim() : "";
      const placeName = typeof row.placeName === "string" ? row.placeName.trim() : "";
      const savedAt = typeof row.savedAt === "number" ? row.savedAt : now;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !placeName) return [];
      if (now - savedAt > COMMITTED_PLAN_SPOT_TTL_MS) return [];
      const photoPath = typeof row.photoPath === "string" ? row.photoPath.trim() : "";
      const sourceCatchId = typeof row.sourceCatchId === "string" ? row.sourceCatchId.trim() : "";
      const sourceBaitId = typeof row.sourceBaitId === "string" ? row.sourceBaitId.trim() : "";
      return [
        {
          day,
          placeName,
          savedAt,
          speciesTargets: parseSpeciesTargets(row.speciesTargets),
          ...(sourceCatchId ? { sourceCatchId } : {}),
          ...(sourceBaitId ? { sourceBaitId } : {}),
          ...(photoPath ? { photoPath } : {}),
        },
      ];
    });
  } catch {
    return [];
  }
}

export function dropCommittedPlanSpotsForDay(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null | undefined,
  day: string,
): void {
  if (!storage || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  const next = readCommittedPlanSpots(storage).filter((spot) => spot.day !== day);
  try {
    if (!next.length) storage.removeItem(COMMITTED_PLAN_SPOTS_STORAGE_KEY);
    else storage.setItem(COMMITTED_PLAN_SPOTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
}


export function writePendingPlanDay(
  storage: Pick<Storage, "setItem"> | null | undefined,
  day: string,
): void {
  if (!storage || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  try {
    storage.setItem(PENDING_PLAN_DAY_STORAGE_KEY, day);
  } catch {
    /* private mode */
  }
}

export function readPendingPlanDay(
  storage: Pick<Storage, "getItem"> | null | undefined,
): string | null {
  if (!storage) return null;
  try {
    const day = storage.getItem(PENDING_PLAN_DAY_STORAGE_KEY)?.trim() ?? "";
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
  } catch {
    return null;
  }
}

/** URL has the add handoff plus a picked day, or the angler already tapped a day. */
export function pendingPlanDayToCommit(
  fromSearch: PendingPlanSpot | null,
  dateFromUrl?: string | null,
  storedDay?: string | null,
): string | null {
  const day =
    (dateFromUrl && /^\d{4}-\d{2}-\d{2}$/.test(dateFromUrl) ? dateFromUrl : null) ||
    (storedDay && /^\d{4}-\d{2}-\d{2}$/.test(storedDay) ? storedDay : null);
  if (!day) return null;
  if (fromSearch?.catchId || fromSearch?.baitId || fromSearch?.placeName) return day;
  if (storedDay === day) return day;
  return null;
}

/** URL handoff wins; session fills in place/species when the query is only a catch id. */
export function resolvePendingPlanSpot(
  fromSearch: PendingPlanSpot | null,
  fromStorage: PendingPlanSpot | null,
): PendingPlanSpot | null {
  if (fromSearch?.catchId) {
    if (fromStorage?.catchId === fromSearch.catchId) {
      const photoPath = fromStorage.photoPath || fromSearch.photoPath;
      return {
        catchId: fromSearch.catchId,
        baitId: fromStorage.baitId,
        placeName: fromStorage.placeName || fromSearch.placeName,
        speciesTargets: fromStorage.speciesTargets.length
          ? fromStorage.speciesTargets
          : fromSearch.speciesTargets,
        ...(photoPath ? { photoPath } : {}),
        savedAt: fromStorage.savedAt,
      };
    }
    return fromSearch;
  }
  if (fromSearch?.baitId) {
    if (fromStorage?.baitId === fromSearch.baitId) {
      const photoPath = fromStorage.photoPath || fromSearch.photoPath;
      return {
        baitId: fromSearch.baitId,
        catchId: fromStorage.catchId,
        placeName: fromStorage.placeName || fromSearch.placeName,
        speciesTargets: fromStorage.speciesTargets.length
          ? fromStorage.speciesTargets
          : fromSearch.speciesTargets,
        ...(photoPath ? { photoPath } : {}),
        savedAt: fromStorage.savedAt,
      };
    }
    return fromSearch;
  }
  if (fromSearch?.placeName) return fromSearch;
  if (fromStorage?.placeName || fromStorage?.catchId || fromStorage?.baitId) return fromStorage;
  return null;
}

export function isOwnCatchForPlan(
  record: { anglerId?: string | null },
  viewerId?: string | null,
): boolean {
  return Boolean(viewerId && record.anglerId === viewerId);
}

export function canShowAddToPlan(
  record: {
    anglerId?: string | null;
    placeName?: string | null;
  },
  viewerId?: string | null,
  showAddToPlan?: boolean,
): boolean {
  return Boolean(showAddToPlan && isOwnCatchForPlan(record, viewerId) && trimPlace(record.placeName));
}

export function pendingPlanPrompt(spot: PendingPlanSpot | null): string | null {
  if (!spot) return null;
  if (spot.placeName) return `Pick a day to add ${spot.placeName}.`;
  if (spot.catchId || spot.baitId) return "Looking up that spot…";
  return "Pick a day to add this spot.";
}
