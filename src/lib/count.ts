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

export function fishCountLabel(count: number): string {
  return count === 1 ? "1 fish" : `${count} fish`;
}
