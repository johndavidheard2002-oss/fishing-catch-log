import {
  DEFAULT_HABITAT,
  SPECIES_CATALOG,
  catalogHabitat,
  inferHabitat,
  isSaltwaterCatalogSpecies,
  isSaltwaterHabitat,
  saltwaterSpecies,
  speciesForHabitat,
  type Habitat,
} from "./habitat";
import type { SpeciesSource, SpeciesSuggestion } from "./types";

const ALIASES: Record<string, string> = {
  "red drum": "Redfish",
  redfish: "Redfish",
  "channel bass": "Redfish",
  "puppy drum": "Redfish",
  "spotted seatrout": "Speckled Trout",
  "speckled seatrout": "Speckled Trout",
  "spotted trout": "Speckled Trout",
  seatrout: "Speckled Trout",
  "sea trout": "Speckled Trout",
  "speckled trout": "Speckled Trout",
  "cynoscion nebulosus": "Speckled Trout",
  dolphin: "Mahi-mahi",
  dolphinfish: "Mahi-mahi",
  dorado: "Mahi-mahi",
  mahi: "Mahi-mahi",
  "mahi mahi": "Mahi-mahi",
  "mahi-mahi": "Mahi-mahi",
  "florida pompano": "Pompano",
  "southern flounder": "Flounder",
  fluke: "Flounder",
  "summer flounder": "Flounder",
  "gray snapper": "Mangrove Snapper",
  "mangrove snapper": "Mangrove Snapper",
  gag: "Gag Grouper",
  "gag grouper": "Gag Grouper",
  kingfish: "King Mackerel",
  "king mackerel": "King Mackerel",
  "kingfish mackerel": "King Mackerel",
  "spanish mackerel": "Spanish Mackerel",
  ling: "Cobia",
  cobia: "Cobia",
  "crevalle jack": "Jack Crevalle",
  "jack crevalle": "Jack Crevalle",
  "jack crevalle jack": "Jack Crevalle",
  striper: "Striped Bass",
  "striped bass": "Striped Bass",
  rockfish: "Striped Bass",
  largemouth: "Largemouth Bass",
  "largemouth bass": "Largemouth Bass",
  bucketmouth: "Largemouth Bass",
  smallmouth: "Smallmouth Bass",
  "smallmouth bass": "Smallmouth Bass",
  "spotted bass": "Spotted Bass",
  "white bass": "White Bass",
  bluegill: "Bluegill",
  bream: "Bluegill",
  crappie: "Crappie",
  "black crappie": "Crappie",
  "white crappie": "Crappie",
  "rainbow trout": "Rainbow Trout",
  "brown trout": "Brown Trout",
  "brook trout": "Brook Trout",
  walleye: "Walleye",
  "yellow perch": "Yellow Perch",
  "channel cat": "Channel Catfish",
  "channel catfish": "Channel Catfish",
  "flathead catfish": "Flathead Catfish",
  "blue catfish": "Blue Catfish",
  "red snapper": "Red Snapper",
  "vermilion snapper": "Vermilion Snapper",
  wahoo: "Wahoo",
  "yellowfin tuna": "Yellowfin Tuna",
  "blackfin tuna": "Blackfin Tuna",
  amberjack: "Amberjack",
  "greater amberjack": "Amberjack",
  sheepshead: "Sheepshead",
  snook: "Snook",
  tarpon: "Tarpon",
  bonefish: "Bonefish",
  permit: "Permit",
  tripletail: "Tripletail",
  ladyfish: "Ladyfish",
  whiting: "Whiting",
  "king whiting": "Whiting",
  "black drum": "Black Drum",
  "sailfish": "Sailfish",
  "white marlin": "White Marlin",
  "blue marlin": "Blue Marlin",
  swordfish: "Swordfish",
  triggerfish: "Triggerfish",
  barracuda: "Barracuda",
  "northern pike": "Northern Pike",
  muskie: "Muskellunge",
  muskellunge: "Muskellunge",
  steelhead: "Steelhead",
  carp: "Carp",
  "freshwater drum": "Freshwater Drum",
  "redear sunfish": "Redear Sunfish",
  "cutthroat trout": "Cutthroat Trout",
};

function key(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ");
}

function catalogNames(habitat?: Habitat | null): string[] {
  if (habitat) return speciesForHabitat(habitat);
  return SPECIES_CATALOG.map((s) => s.name);
}

function exactIn(names: string[], target: string) {
  return names.find((n) => key(n) === target) ?? null;
}

function containsIn(names: string[], target: string) {
  return (
    names.find((n) => {
      const nk = key(n);
      return nk.includes(target) || target.includes(nk);
    }) ?? null
  );
}

/** Map a model/common name onto the journal catalog when we can. */
export function matchCatalogSpecies(
  raw: string | null | undefined,
  habitat?: Habitat | null,
): string | null {
  if (!raw?.trim()) return null;
  const k = key(raw);
  if (!k || k === "unknown" || k === "not a fish" || k === "none") return null;

  const aliased = ALIASES[k];
  const pool = catalogNames(habitat);
  const wider = catalogNames();

  if (aliased) {
    return exactIn(pool, key(aliased)) ?? exactIn(wider, key(aliased)) ?? aliased;
  }

  const exact = exactIn(pool, k) ?? exactIn(wider, k);
  if (exact) return exact;

  return containsIn(pool, k) ?? containsIn(wider, k) ?? null;
}

/** Map a model/common name onto inshore/offshore only. Never returns bass, trout, or other FW names. */
export function matchSaltwaterCatalogSpecies(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const k = key(raw);
  if (!k || k === "unknown" || k === "not a fish" || k === "none") return null;

  const pool = saltwaterSpecies();
  const aliased = ALIASES[k];
  if (aliased) {
    const hit = exactIn(pool, key(aliased));
    if (hit) return hit;
  }

  const exact = exactIn(pool, k);
  if (exact) return exact;

  const contained = containsIn(pool, k);
  return contained && isSaltwaterCatalogSpecies(contained) ? contained : null;
}

export function resolveSpeciesName(
  raw: string | null | undefined,
  habitat?: Habitat | null,
): string {
  return matchCatalogSpecies(raw, habitat) ?? raw?.trim() ?? "Unknown";
}

export function habitatForSuggestion(
  species: string,
  hinted?: Habitat | null,
): Habitat {
  return catalogHabitat(species) ?? inferHabitat(species, hinted ?? DEFAULT_HABITAT);
}

export const SPECIES_AUTO_FILL_MIN = 0.5;

export function restrictSuggestionToSaltwater(suggestion: SpeciesSuggestion): SpeciesSuggestion {
  const mapped = matchSaltwaterCatalogSpecies(suggestion.species);
  const list = normalizeSpeciesList(
    mapped,
    (suggestion.speciesList ?? [])
      .map((name) => matchSaltwaterCatalogSpecies(name))
      .filter((name): name is string => Boolean(name)),
  ).filter(isSaltwaterCatalogSpecies);
  const alternatives = (suggestion.alternatives ?? [])
    .map((row) => ({
      species: matchSaltwaterCatalogSpecies(row.species) ?? "",
      confidence: row.confidence,
    }))
    .filter((row) => row.species && isSaltwaterCatalogSpecies(row.species));
  const top = mapped ?? list[0] ?? null;
  if (!top) {
    return {
      ...suggestion,
      species: "Unknown",
      speciesList: [],
      alternatives,
      habitat: isSaltwaterHabitat(suggestion.habitat) ? suggestion.habitat : DEFAULT_HABITAT,
      confidence: Math.min(suggestion.confidence, 0.39),
    };
  }
  return {
    ...suggestion,
    species: top,
    speciesList: list.length ? list : [top],
    alternatives: alternatives.filter((row) => row.species.toLowerCase() !== top.toLowerCase()),
    habitat: catalogHabitat(top) ?? DEFAULT_HABITAT,
  };
}

export function autoFillSpecies(suggestion: SpeciesSuggestion): string | null {
  const clean = restrictSuggestionToSaltwater(suggestion);
  if (clean.confidence < SPECIES_AUTO_FILL_MIN) return null;
  if (!isSaltwaterCatalogSpecies(clean.species)) return null;
  return clean.species;
}

export function formPatchFromSuggestion(suggestion: SpeciesSuggestion): {
  speciesList: string[];
  speciesSuggested: string;
  speciesConfidence: number;
  speciesSource: SpeciesSource;
  habitat: Habitat;
  speciesAlternatives: { species: string; confidence: number }[];
  speciesSuggestedList: string[];
} {
  const clean = restrictSuggestionToSaltwater(suggestion);
  const fill = autoFillSpecies(clean);
  return {
    speciesList: fill ? [fill] : [],
    speciesSuggested: fill ?? "",
    speciesConfidence: clean.confidence,
    speciesSource: fill ? (clean.source === "openai" ? "vision" : "demo") : "manual",
    habitat: fill
      ? habitatForSuggestion(fill)
      : isSaltwaterHabitat(clean.habitat)
        ? clean.habitat
        : DEFAULT_HABITAT,
    speciesAlternatives: clean.alternatives,
    speciesSuggestedList: clean.speciesList ?? [],
  };
}

export function normalizeSpeciesList(
  species?: string | null,
  list?: string[] | null,
): string[] {
  const fromList = (list ?? []).map((s) => s.trim()).filter(Boolean);
  const primary = species?.trim();
  const merged = fromList.length ? fromList : primary ? [primary] : [];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const name of merged) {
    const k = name.toLowerCase();
    if (seen.has(k) || k === "unknown") continue;
    seen.add(k);
    unique.push(name);
  }
  if (unique.length) return unique;
  if (primary?.toLowerCase() === "unknown") return ["Unknown"];
  return [];
}

export function primarySpecies(list: string[]): string {
  return list[0] || "Unknown";
}

export function speciesLabel(list: string[] | string | null | undefined): string {
  const names = Array.isArray(list) ? list.filter(Boolean) : list ? [list] : [];
  if (!names.length) return "Unknown";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} + ${names[1]}`;
  return `${names[0]} + ${names.length - 1} more`;
}

export function speciesListMatchesQuery(list: string[], q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return list.some((s) => s.toLowerCase().includes(needle));
}

export function speciesListsOverlap(a: string[], b: string[]): boolean {
  const set = new Set(a.map((s) => s.trim().toLowerCase()).filter(Boolean));
  return b.some((s) => set.has(s.trim().toLowerCase()));
}

export function parseSpeciesListJson(raw: string | null | undefined): string[] | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  } catch {
    return null;
  }
}
