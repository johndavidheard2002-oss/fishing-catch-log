import {
  DEFAULT_HABITAT,
  isDuckCatalogSpecies,
  isSaltwaterCatalogSpecies,
  isSaltwaterHabitat,
  saltwaterHintFromLocation,
  saltwaterSpecies,
  type Habitat,
} from "../habitat";
import {
  habitatForSuggestion,
  matchCatalogSpecies,
  matchDuckCatalogSpecies,
  matchSaltwaterCatalogSpecies,
  restrictSuggestionToSaltwater,
} from "../species";
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
  fileName?: string | null;
};

function saltwaterPool(context?: VisionContext): { names: string[]; habitat: Habitat | null } {
  const hinted =
    (context?.habitat && isSaltwaterHabitat(context.habitat) ? context.habitat : null) ??
    saltwaterHintFromLocation(context?.latitude, context?.longitude, context?.placeName);
  return {
    names: saltwaterSpecies(hinted),
    habitat: hinted,
  };
}

function fileNameBase(fileName?: string | null): string {
  if (!fileName?.trim()) return "";
  return fileName
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ");
}

export function saltwaterNameFromFileName(fileName?: string | null): string | null {
  return matchSaltwaterCatalogSpecies(fileNameBase(fileName));
}

function freshwaterFileName(fileName?: string | null): boolean {
  const base = fileNameBase(fileName);
  if (!base) return false;
  if (matchSaltwaterCatalogSpecies(base)) return false;
  if (matchDuckCatalogSpecies(base) || duckFileName(fileName)) return false;
  const any = matchCatalogSpecies(base);
  return Boolean(any && !isSaltwaterCatalogSpecies(any) && !isDuckCatalogSpecies(any));
}

function duckFileName(fileName?: string | null): boolean {
  const base = fileNameBase(fileName);
  if (!base) return false;
  return Boolean(matchDuckCatalogSpecies(base));
}

/** Stable fake ID so the same photo keeps the same suggestion in demo mode. */
export function demoIdentifySpecies(
  image: Uint8Array,
  context?: VisionContext,
): SpeciesSuggestion {
  if (duckFileName(context?.fileName)) {
    return restrictSuggestionToSaltwater({
      species: "Unknown",
      confidence: 0.2,
      habitat: DEFAULT_HABITAT,
      speciesList: [],
      alternatives: [],
      source: "demo",
      note: "Demo species assist (no OpenAI key). Filename looks like a duck — left blank so you can pick Duck.",
    });
  }

  if (freshwaterFileName(context?.fileName)) {
    return restrictSuggestionToSaltwater({
      species: "Unknown",
      confidence: 0.2,
      habitat: DEFAULT_HABITAT,
      speciesList: [],
      alternatives: [],
      source: "demo",
      note: "Demo species assist (no OpenAI key). Filename looks like a freshwater fish — left blank.",
    });
  }

  const fromFile = saltwaterNameFromFileName(context?.fileName);
  if (fromFile) {
    return restrictSuggestionToSaltwater({
      species: fromFile,
      confidence: 0.58,
      habitat: habitatForSuggestion(fromFile),
      speciesList: [fromFile],
      alternatives: [],
      source: "demo",
      note: "Demo species assist (no OpenAI key). Matched a saltwater catalog name from the filename — not a real ID.",
    });
  }

  const { names, habitat } = saltwaterPool(context);
  const pool = names.length ? names : saltwaterSpecies();
  const h = hashBytes(image);
  const raw = pool[h % pool.length];
  const species = matchSaltwaterCatalogSpecies(raw) || raw;
  const alt1 = matchSaltwaterCatalogSpecies(pool[(h + 3) % pool.length]) || pool[(h + 3) % pool.length];
  const alt2 = matchSaltwaterCatalogSpecies(pool[(h + 7) % pool.length]) || pool[(h + 7) % pool.length];
  const confidence = Number((0.52 + ((h % 12) / 100)).toFixed(2));

  return restrictSuggestionToSaltwater({
    species,
    confidence,
    habitat: habitatForSuggestion(species, habitat ?? DEFAULT_HABITAT),
    speciesList: [species],
    alternatives: [
      { species: alt1, confidence: Number(Math.max(0.12, confidence - 0.08).toFixed(2)) },
      { species: alt2, confidence: Number(Math.max(0.1, confidence - 0.14).toFixed(2)) },
    ].filter((a) => a.species !== species),
    source: "demo",
    note: "Demo species assist (no OpenAI key). Saltwater catalog only — not a real ID. Confirm the name.",
  });
}
