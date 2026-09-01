import { COMMON_SPECIES } from "../labels";
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

/** Stable fake ID so the same photo keeps the same suggestion in demo mode. */
export function demoIdentifySpecies(image: Uint8Array): SpeciesSuggestion {
  const pool = COMMON_SPECIES.filter((s) => s !== "Unknown");
  const h = hashBytes(image);
  const species = pool[h % pool.length];
  const alt1 = pool[(h + 3) % pool.length];
  const alt2 = pool[(h + 7) % pool.length];
  const confidence = 0.32 + ((h % 18) / 100);

  return {
    species,
    confidence: Number(confidence.toFixed(2)),
    alternatives: [
      { species: alt1, confidence: Number((confidence - 0.08).toFixed(2)) },
      { species: alt2, confidence: Number((confidence - 0.14).toFixed(2)) },
    ],
    source: "demo",
    note: "Demo species assist (no vision API key). Treat this as a guess — edit before you trust it.",
  };
}
