import { parseSpeciesTargets } from "./notes";

export const PENDING_PLAN_SPOT_STORAGE_KEY = "tide-mark-pending-plan-spot";
export const PENDING_PLAN_CATCH_QUERY = "addCatch";
export const PENDING_PLAN_PLACE_QUERY = "addPlace";
export const PENDING_PLAN_SPECIES_QUERY = "addSpecies";

/** Drop an abandoned handoff after this long so a later Plan visit stays clean. */
export const PENDING_PLAN_SPOT_TTL_MS = 2 * 60 * 60 * 1000;

export type PendingPlanSpot = {
  catchId?: string;
  placeName: string;
  speciesTargets: string[];
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
}): PendingPlanSpot | null {
  const placeName = trimPlace(record.placeName);
  if (!placeName) return null;
  const names = record.speciesList?.length
    ? record.speciesList
    : record.species
      ? [record.species]
      : [];
  return {
    catchId: record.id,
    placeName,
    speciesTargets: parseSpeciesTargets(names),
  };
}

export function planHrefForPendingSpot(spot: PendingPlanSpot): string {
  const params = new URLSearchParams();
  if (spot.catchId?.trim()) {
    params.set(PENDING_PLAN_CATCH_QUERY, spot.catchId.trim());
  } else {
    params.set(PENDING_PLAN_PLACE_QUERY, spot.placeName);
    if (spot.speciesTargets.length) {
      params.set(PENDING_PLAN_SPECIES_QUERY, spot.speciesTargets.join(","));
    }
  }
  return `/plan?${params.toString()}`;
}

export function parsePendingPlanSpotSearch(search: {
  get(name: string): string | null;
}): PendingPlanSpot | null {
  const catchId = search.get(PENDING_PLAN_CATCH_QUERY)?.trim() || undefined;
  const placeName = trimPlace(search.get(PENDING_PLAN_PLACE_QUERY));
  const speciesRaw = search.get(PENDING_PLAN_SPECIES_QUERY);
  const speciesTargets = speciesRaw ? parseSpeciesTargets(speciesRaw.split(",")) : [];
  if (catchId) {
    return { catchId, placeName, speciesTargets };
  }
  if (placeName) {
    return { placeName, speciesTargets };
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
    const placeName = typeof parsed.placeName === "string" ? parsed.placeName.trim() : "";
    if (!catchId && !placeName) return null;
    return {
      catchId: catchId || undefined,
      placeName,
      speciesTargets: parseSpeciesTargets(parsed.speciesTargets),
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
  } catch {
    /* private mode */
  }
}

/** URL handoff wins; session fills in place/species when the query is only a catch id. */
export function resolvePendingPlanSpot(
  fromSearch: PendingPlanSpot | null,
  fromStorage: PendingPlanSpot | null,
): PendingPlanSpot | null {
  if (fromSearch?.catchId) {
    if (fromStorage?.catchId === fromSearch.catchId) {
      return {
        catchId: fromSearch.catchId,
        placeName: fromStorage.placeName || fromSearch.placeName,
        speciesTargets: fromStorage.speciesTargets.length
          ? fromStorage.speciesTargets
          : fromSearch.speciesTargets,
        savedAt: fromStorage.savedAt,
      };
    }
    return fromSearch;
  }
  if (fromSearch?.placeName) return fromSearch;
  if (fromStorage?.placeName || fromStorage?.catchId) return fromStorage;
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
    species?: string | null;
    speciesList?: string[] | null;
  },
  viewerId?: string | null,
  showAddToPlan?: boolean,
): boolean {
  return Boolean(
    showAddToPlan && isOwnCatchForPlan(record, viewerId) && pendingPlanSpotFromCatch(record),
  );
}

export function pendingPlanPrompt(spot: PendingPlanSpot | null): string | null {
  if (!spot) return null;
  if (spot.placeName) return `Pick a day to add ${spot.placeName}.`;
  if (spot.catchId) return "Looking up that spot…";
  return "Pick a day to add this spot.";
}
