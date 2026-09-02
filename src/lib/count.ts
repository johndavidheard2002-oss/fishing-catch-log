import type { CatchRecord } from "./types";

export const MIN_FISH_COUNT = 1;
export const MAX_FISH_COUNT = 99;

export function clampFishCount(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return MIN_FISH_COUNT;
  return Math.min(MAX_FISH_COUNT, Math.max(MIN_FISH_COUNT, Math.round(n)));
}

export function clampSpeciesCount(value: number | string | null | undefined): number {
  return clampFishCount(value);
}

/** Digits only while typing — empty string is allowed until blur/submit. */
export function sanitizeFishCountDraft(raw: string): string {
  return raw.replace(/[^\d]/g, "").slice(0, 2);
}

export function draftFishCountForSpecies(draft: string): string {
  return String(clampFishCount(draft.trim() === "" ? null : draft));
}

export function fishCountLabel(count: number): string {
  return count === 1 ? "1 fish" : `${count} fish`;
}

export type SpeciesCount = { species: string; count: number };

export function totalFishCount(rows: SpeciesCount[]): number {
  return rows.reduce((n, row) => n + row.count, 0);
}

export function speciesCountLine(rows: SpeciesCount[]): string {
  return rows.map((row) => `${row.species} ${row.count}`).join(" · ");
}

export function parseSpeciesCountsJson(raw: string | null | undefined): SpeciesCount[] | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const rows = parsed
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const rec = row as { species?: unknown; count?: unknown };
          const species = typeof rec.species === "string" ? rec.species.trim() : "";
          const count = typeof rec.count === "number" ? rec.count : Number(rec.count);
          if (!species || !Number.isFinite(count)) return null;
          return { species, count };
        })
        .filter((row): row is SpeciesCount => row != null);
      return rows.length ? rows : null;
    }
    if (parsed && typeof parsed === "object") {
      const rows = Object.entries(parsed as Record<string, unknown>)
        .map(([species, count]) => {
          const n = typeof count === "number" ? count : Number(count);
          const name = species.trim();
          if (!name || !Number.isFinite(n)) return null;
          return { species: name, count: n };
        })
        .filter((row): row is SpeciesCount => row != null);
      return rows.length ? rows : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function normalizeSpeciesCounts(
  speciesList: string[],
  counts?: SpeciesCount[] | null,
): SpeciesCount[] {
  const names = speciesList.map((s) => s.trim()).filter(Boolean);
  const list = names.length ? names : ["Unknown"];
  const byName = new Map<string, number>();
  for (const row of counts ?? []) {
    const key = row.species.trim().toLowerCase();
    if (!key) continue;
    byName.set(key, clampSpeciesCount(row.count));
  }
  return list.map((species) => ({
    species,
    count: byName.get(species.toLowerCase()) ?? MIN_FISH_COUNT,
  }));
}

/** Legacy: split a single total across tagged species; leftover goes to the first tag. */
export function splitTotalAcrossSpecies(speciesList: string[], total: number): SpeciesCount[] {
  const names = speciesList.map((s) => s.trim()).filter(Boolean);
  const list = names.length ? names : ["Unknown"];
  const n = clampFishCount(total);
  if (list.length === 1) return [{ species: list[0], count: n }];
  const base = Math.max(MIN_FISH_COUNT, Math.floor(n / list.length));
  let leftover = n - base * list.length;
  return list.map((species) => {
    const extra = leftover > 0 ? 1 : 0;
    leftover -= extra;
    return { species, count: Math.min(MAX_FISH_COUNT, base + extra) };
  });
}

export function countsForCatch(
  record: Pick<CatchRecord, "species" | "speciesList" | "fishCount" | "speciesCounts">,
): SpeciesCount[] {
  const names = (record.speciesList?.length ? record.speciesList : [record.species])
    .map((s) => s.trim())
    .filter(Boolean);
  const list = names.length ? names : ["Unknown"];
  if (record.speciesCounts?.length) {
    return normalizeSpeciesCounts(list, record.speciesCounts);
  }
  return splitTotalAcrossSpecies(list, record.fishCount);
}

export function catchFishLabel(
  record: Pick<CatchRecord, "species" | "speciesList" | "fishCount" | "speciesCounts">,
): string {
  const rows = countsForCatch(record);
  const total = totalFishCount(rows) || record.fishCount || 1;
  if (rows.length <= 1) return fishCountLabel(total);
  return `${fishCountLabel(total)} · ${speciesCountLine(rows)}`;
}

export function catchSpeciesTitle(
  record: Pick<CatchRecord, "species" | "speciesList" | "fishCount" | "speciesCounts">,
): string {
  const rows = countsForCatch(record);
  if (rows.length > 1) return speciesCountLine(rows);
  return rows[0]?.species || record.species;
}

/** Sum stored (or split) per-species counts across trips at a spot. */
export function speciesFishCounts(records: CatchRecord[]): SpeciesCount[] {
  const map = new Map<string, number>();
  for (const record of records) {
    for (const row of countsForCatch(record)) {
      map.set(row.species, (map.get(row.species) ?? 0) + row.count);
    }
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([species, count]) => ({ species, count }));
}

export function alignCountDrafts(
  speciesList: string[],
  previous: Record<string, string>,
  singleDraft: string,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const name of speciesList) {
    if (Object.prototype.hasOwnProperty.call(previous, name)) {
      next[name] = previous[name];
    } else if (speciesList.length === 1) {
      next[name] = singleDraft;
    } else {
      next[name] = "1";
    }
  }
  return next;
}

export function draftsFromCounts(rows: SpeciesCount[]): Record<string, string> {
  return Object.fromEntries(rows.map((row) => [row.species, String(row.count)]));
}

export function resolveCatchCounts(
  speciesList: string[],
  counts?: SpeciesCount[] | null,
  fishCount?: number | null,
): { speciesCounts: SpeciesCount[]; fishCount: number } {
  const names = speciesList.map((s) => s.trim()).filter(Boolean);
  const list = names.length ? names : ["Unknown"];
  if (counts?.length) {
    const rows = normalizeSpeciesCounts(list, counts);
    return { speciesCounts: rows, fishCount: totalFishCount(rows) };
  }
  if (fishCount != null) {
    const rows = splitTotalAcrossSpecies(list, fishCount);
    return { speciesCounts: rows, fishCount: totalFishCount(rows) };
  }
  const rows = normalizeSpeciesCounts(list, null);
  return { speciesCounts: rows, fishCount: totalFishCount(rows) };
}

export function countsFromDrafts(
  speciesList: string[],
  drafts: Record<string, string>,
  singleDraft: string,
): SpeciesCount[] {
  if (speciesList.length <= 1) {
    const name = speciesList[0] || "Unknown";
    return [{ species: name, count: clampFishCount(singleDraft) }];
  }
  return normalizeSpeciesCounts(
    speciesList,
    speciesList.map((species) => ({
      species,
      count: clampSpeciesCount(drafts[species]),
    })),
  );
}
