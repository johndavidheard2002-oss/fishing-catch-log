import type { CatchRecord } from "./types";

export const MIN_FISH_COUNT = 1;
export const MAX_FISH_COUNT = 99;

export function clampFishCount(
  value: number | string | null | undefined,
  speciesCount = 1,
): number {
  const fallback = Math.max(MIN_FISH_COUNT, speciesCount || 1);
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_FISH_COUNT, Math.max(fallback, Math.round(n)));
}

/** Digits only while typing — empty string is allowed until blur/submit. */
export function sanitizeFishCountDraft(raw: string): string {
  return raw.replace(/[^\d]/g, "").slice(0, 2);
}

export function draftFishCountForSpecies(draft: string, speciesCount: number): string {
  return String(clampFishCount(draft.trim() === "" ? null : draft, speciesCount));
}

export function fishCountLabel(count: number): string {
  return count === 1 ? "1 fish" : `${count} fish`;
}

export type SpeciesCount = { species: string; count: number };

/** Split a catch's fishCount across tagged species; leftover goes to the first tag. */
export function speciesFishCounts(records: CatchRecord[]): SpeciesCount[] {
  const map = new Map<string, number>();
  for (const record of records) {
    const names = (record.speciesList?.length ? record.speciesList : [record.species])
      .map((s) => s.trim())
      .filter(Boolean);
    const list = names.length ? names : ["Unknown"];
    const n = clampFishCount(record.fishCount, list.length);
    if (list.length === 1) {
      map.set(list[0], (map.get(list[0]) ?? 0) + n);
      continue;
    }
    const base = Math.floor(n / list.length);
    const extra = n - base * list.length;
    list.forEach((name, i) => {
      const add = base + (i === 0 ? extra : 0);
      map.set(name, (map.get(name) ?? 0) + add);
    });
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([species, count]) => ({ species, count }));
}

export function speciesCountLine(rows: SpeciesCount[]): string {
  return rows.map((row) => `${row.species} ${row.count}`).join(" · ");
}
