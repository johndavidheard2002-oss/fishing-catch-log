import { photoSrc } from "./photo";
import type { BaitSpot, BaitSpotGroup, CatchRecord, SpotGroup } from "./types";

const SPECIES_PLACEHOLDERS: { test: RegExp; src: string }[] = [
  { test: /\b(redfish|red drum)\b/i, src: "/seed/redfish.svg" },
  { test: /\b(speckled|speck|trout)\b/i, src: "/seed/speckled.svg" },
  { test: /\b(mahi|dorado|dolphin)\b/i, src: "/seed/mahi.svg" },
  { test: /\b(striper|striped bass)\b/i, src: "/seed/striper.svg" },
  { test: /\b(largemouth)\b/i, src: "/seed/largemouth.svg" },
  { test: /\b(walleye)\b/i, src: "/seed/walleye.svg" },
  { test: /\b(bluegill)\b/i, src: "/seed/bluegill.svg" },
  { test: /\b(rainbow)\b/i, src: "/seed/rainbow.svg" },
];

export function speciesPlaceholderSrc(species: string[] | string | null | undefined): string | null {
  const blob = (Array.isArray(species) ? species : species ? [species] : []).join(" ");
  if (!blob.trim()) return null;
  for (const row of SPECIES_PLACEHOLDERS) {
    if (row.test.test(blob)) return row.src;
  }
  return null;
}

function firstPhotoSrc(paths: Array<string | null | undefined>): string | null {
  for (const path of paths) {
    const src = photoSrc(path ?? null);
    if (src) return src;
  }
  return null;
}

export function catchRecordThumbSrc(record: CatchRecord): string | null {
  return photoSrc(record.photoPath) ?? speciesPlaceholderSrc(record.speciesList?.length ? record.speciesList : record.species);
}

export function baitRecordThumbSrc(spot: BaitSpot): string | null {
  return photoSrc(spot.photoPath);
}

export function catchGroupThumbSrc(group: SpotGroup): string | null {
  return firstPhotoSrc(group.catches.map((c) => c.photoPath)) ?? speciesPlaceholderSrc(group.species);
}

export function baitGroupThumbSrc(group: BaitSpotGroup): string | null {
  return firstPhotoSrc(group.spots.map((s) => s.photoPath));
}
