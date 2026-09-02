import { habitatHintFromLocation, isHabitat, speciesForHabitat, type Habitat } from "../habitat";
import { COMMON_SPECIES } from "../labels";
import { habitatForSuggestion, resolveSpeciesName } from "../species";
import type { SpeciesSuggestion } from "../types";

function hashBytes(bytes: Uint8Array): number {
  let h = 2166136261;
  const sample = bytes.length > 2048 ? bytes.subarray(0, 2048) : bytes;
  for (let i = 0; i < sample.length; i++) {
    h ^= sample[i];
    h = Math.imul(h, 16777619);
  }
  h ^= bytes.length;
  return h >>> 0;
}

export type VisionContext = {
  latitude?: number | null;
  longitude?: number | null;
  habitat?: Habitat | null;
  placeName?: string | null;
};

function poolForContext(context?: VisionContext): { names: string[]; habitat: Habitat | null; mixed: boolean } {
  const hinted =
    (context?.habitat && isHabitat(context.habitat) ? context.habitat : null) ??
    habitatHintFromLocation(context?.latitude, context?.longitude, context?.placeName);
  if (hinted) {
    return { names: speciesForHabitat(hinted), habitat: hinted, mixed: false };
  }
  return {
    names: COMMON_SPECIES.filter((s) => s !== "Unknown"),
    habitat: null,
    mixed: true,
  };
}

/** Stable fake ID so the same photo keeps the same suggestion in demo mode. */
export function demoIdentifySpecies(
  image: Uint8Array,
  context?: VisionContext,
): SpeciesSuggestion {
  const { names, habitat, mixed } = poolForContext(context);
  const pool = names.length ? names : COMMON_SPECIES.filter((s) => s !== "Unknown");
  const h = hashBytes(image);
  const raw = pool[h % pool.length];
  const species = resolveSpeciesName(raw, habitat) || raw;
  const alt1 = resolveSpeciesName(pool[(h + 3) % pool.length], habitat) || pool[(h + 3) % pool.length];
  const alt2 = resolveSpeciesName(pool[(h + 7) % pool.length], habitat) || pool[(h + 7) % pool.length];
  const confidence = mixed
    ? Number((0.22 + ((h % 12) / 100)).toFixed(2))
    : Number((0.34 + ((h % 14) / 100)).toFixed(2));

  return {
    species,
    confidence,
    habitat: habitatForSuggestion(species, habitat),
    alternatives: [
      { species: alt1, confidence: Number(Math.max(0.12, confidence - 0.08).toFixed(2)) },
      { species: alt2, confidence: Number(Math.max(0.1, confidence - 0.14).toFixed(2)) },
    ].filter((a) => a.species !== species),
    source: "demo",
    note: mixed
      ? "Demo species assist (no OpenAI key). Guess is from the mixed catalog — pick habitat or type the name. Not a real ID."
      : `Demo species assist (no OpenAI key). Guess is from the ${habitat} list only — not a real ID. Edit before you trust it.`,
  };
}
