import {
  SPECIES_CATALOG,
  catalogHabitat,
  inferHabitat,
  speciesForHabitat,
  type Habitat,
} from "./habitat";

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

  const exactIn = (names: string[], target: string) =>
    names.find((n) => key(n) === target) ?? null;

  if (aliased) {
    return exactIn(pool, key(aliased)) ?? exactIn(wider, key(aliased)) ?? aliased;
  }

  const exact = exactIn(pool, k) ?? exactIn(wider, k);
  if (exact) return exact;

  const contains = (names: string[]) =>
    names.find((n) => {
      const nk = key(n);
      return nk.includes(k) || k.includes(nk);
    }) ?? null;

  return contains(pool) ?? contains(wider) ?? null;
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
  return catalogHabitat(species) ?? inferHabitat(species, hinted ?? "freshwater");
}

export const SPECIES_AUTO_FILL_MIN = 0.5;
