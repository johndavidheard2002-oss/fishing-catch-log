export const HABITATS = [
  "freshwater",
  "saltwater-inshore",
  "saltwater-offshore",
] as const;

export type Habitat = (typeof HABITATS)[number];

export const WATER_TYPES = ["freshwater", "saltwater"] as const;
export type WaterType = (typeof WATER_TYPES)[number];

export const HABITAT_LABELS: Record<Habitat, string> = {
  freshwater: "Freshwater",
  "saltwater-inshore": "Inshore",
  "saltwater-offshore": "Offshore",
};

export const WATER_TYPE_LABELS: Record<WaterType, string> = {
  freshwater: "Freshwater",
  saltwater: "Saltwater",
};

export type SpeciesEntry = {
  name: string;
  habitat: Habitat;
};

export const SPECIES_CATALOG: SpeciesEntry[] = [
  { name: "Largemouth Bass", habitat: "freshwater" },
  { name: "Smallmouth Bass", habitat: "freshwater" },
  { name: "Spotted Bass", habitat: "freshwater" },
  { name: "White Bass", habitat: "freshwater" },
  { name: "Rainbow Trout", habitat: "freshwater" },
  { name: "Brown Trout", habitat: "freshwater" },
  { name: "Brook Trout", habitat: "freshwater" },
  { name: "Cutthroat Trout", habitat: "freshwater" },
  { name: "Bluegill", habitat: "freshwater" },
  { name: "Crappie", habitat: "freshwater" },
  { name: "Redear Sunfish", habitat: "freshwater" },
  { name: "Channel Catfish", habitat: "freshwater" },
  { name: "Flathead Catfish", habitat: "freshwater" },
  { name: "Blue Catfish", habitat: "freshwater" },
  { name: "Walleye", habitat: "freshwater" },
  { name: "Yellow Perch", habitat: "freshwater" },
  { name: "Northern Pike", habitat: "freshwater" },
  { name: "Muskellunge", habitat: "freshwater" },
  { name: "Salmon", habitat: "freshwater" },
  { name: "Steelhead", habitat: "freshwater" },
  { name: "Carp", habitat: "freshwater" },
  { name: "Freshwater Drum", habitat: "freshwater" },
  { name: "Redfish", habitat: "saltwater-inshore" },
  { name: "Black Drum", habitat: "saltwater-inshore" },
  { name: "Speckled Trout", habitat: "saltwater-inshore" },
  { name: "Snook", habitat: "saltwater-inshore" },
  { name: "Tarpon", habitat: "saltwater-inshore" },
  { name: "Bonefish", habitat: "saltwater-inshore" },
  { name: "Permit", habitat: "saltwater-inshore" },
  { name: "Sheepshead", habitat: "saltwater-inshore" },
  { name: "Flounder", habitat: "saltwater-inshore" },
  { name: "Pompano", habitat: "saltwater-inshore" },
  { name: "Striped Bass", habitat: "saltwater-inshore" },
  { name: "Bluefish", habitat: "saltwater-inshore" },
  { name: "Spanish Mackerel", habitat: "saltwater-inshore" },
  { name: "Cobia", habitat: "saltwater-inshore" },
  { name: "Mangrove Snapper", habitat: "saltwater-inshore" },
  { name: "Jack Crevalle", habitat: "saltwater-inshore" },
  { name: "Tripletail", habitat: "saltwater-inshore" },
  { name: "Ladyfish", habitat: "saltwater-inshore" },
  { name: "Whiting", habitat: "saltwater-inshore" },
  { name: "Mahi-mahi", habitat: "saltwater-offshore" },
  { name: "Wahoo", habitat: "saltwater-offshore" },
  { name: "Yellowfin Tuna", habitat: "saltwater-offshore" },
  { name: "Blackfin Tuna", habitat: "saltwater-offshore" },
  { name: "King Mackerel", habitat: "saltwater-offshore" },
  { name: "Amberjack", habitat: "saltwater-offshore" },
  { name: "Red Snapper", habitat: "saltwater-offshore" },
  { name: "Vermilion Snapper", habitat: "saltwater-offshore" },
  { name: "Grouper", habitat: "saltwater-offshore" },
  { name: "Gag Grouper", habitat: "saltwater-offshore" },
  { name: "Sailfish", habitat: "saltwater-offshore" },
  { name: "White Marlin", habitat: "saltwater-offshore" },
  { name: "Blue Marlin", habitat: "saltwater-offshore" },
  { name: "Swordfish", habitat: "saltwater-offshore" },
  { name: "Triggerfish", habitat: "saltwater-offshore" },
  { name: "Barracuda", habitat: "saltwater-offshore" },
];

export const COMMON_SPECIES = [
  ...SPECIES_CATALOG.map((s) => s.name),
  "Unknown",
];

export function isHabitat(value: string): value is Habitat {
  return (HABITATS as readonly string[]).includes(value);
}

export function waterTypeOf(habitat: Habitat): WaterType {
  return habitat === "freshwater" ? "freshwater" : "saltwater";
}

export function habitatsForWaterType(water: WaterType): Habitat[] {
  return water === "freshwater"
    ? ["freshwater"]
    : ["saltwater-inshore", "saltwater-offshore"];
}

export function habitatLabel(habitat: Habitat): string {
  if (habitat === "freshwater") return "Freshwater";
  return `Saltwater · ${HABITAT_LABELS[habitat]}`;
}

export function speciesForHabitat(habitat: Habitat): string[] {
  return SPECIES_CATALOG.filter((s) => s.habitat === habitat).map((s) => s.name);
}

export function catalogHabitat(species: string): Habitat | null {
  const key = species.trim().toLowerCase();
  if (!key) return null;
  return SPECIES_CATALOG.find((s) => s.name.toLowerCase() === key)?.habitat ?? null;
}

const OFFSHORE_HINTS = [
  "mahi",
  "dolphin",
  "wahoo",
  "tuna",
  "yellowfin",
  "blackfin",
  "skipjack",
  "marlin",
  "sailfish",
  "swordfish",
  "grouper",
  "amberjack",
  "king mackerel",
  "wahoo",
  "tilefish",
  "triggerfish",
  "barracuda",
  "offshore",
];

const INSHORE_HINTS = [
  "redfish",
  "red drum",
  "black drum",
  "speckled",
  "seatrout",
  "sea trout",
  "snook",
  "tarpon",
  "bonefish",
  "permit",
  "sheepshead",
  "flounder",
  "pompano",
  "bluefish",
  "spanish mackerel",
  "mangrove snapper",
  "crevalle",
  "tripletail",
  "ladyfish",
  "whiting",
  "inshore",
  "red snapper",
];

const FRESH_HINTS = [
  "bass",
  "trout",
  "bluegill",
  "crappie",
  "sunfish",
  "catfish",
  "walleye",
  "perch",
  "pike",
  "muskie",
  "muskellunge",
  "salmon",
  "steelhead",
  "carp",
  "drum",
  "freshwater",
];

export function inferHabitat(species: string, fallback: Habitat = "freshwater"): Habitat {
  const exact = catalogHabitat(species);
  if (exact) return exact;

  const key = species.trim().toLowerCase();
  if (!key || key === "unknown") return fallback;

  if (OFFSHORE_HINTS.some((h) => key.includes(h))) return "saltwater-offshore";
  if (INSHORE_HINTS.some((h) => key.includes(h))) return "saltwater-inshore";
  if (FRESH_HINTS.some((h) => key.includes(h))) return "freshwater";
  return fallback;
}

export function matchesHabitatFilters(
  habitat: Habitat,
  selected?: Habitat[],
): boolean {
  if (!selected?.length) return true;
  return selected.includes(habitat);
}

/**
 * Rough US/Gulf hint from coordinates or a place name so species assist
 * prefers freshwater vs inshore vs offshore when the photo is ambiguous.
 */
export function habitatHintFromLocation(
  lat?: number | null,
  lon?: number | null,
  placeName?: string | null,
): Habitat | null {
  const place = (placeName ?? "").toLowerCase();
  if (place) {
    if (/\b(gulf stream|offshore|canyon|weed.?line|blue water)\b/.test(place)) {
      return "saltwater-offshore";
    }
    if (
      /\b(gulf|lagoon|bay|inshore|flats|marsh|jetty|pass|sound|inlet|beach)\b/.test(
        place,
      )
    ) {
      return "saltwater-inshore";
    }
    if (/\b(lake|pond|river|creek|reservoir|tailwater|farm pond)\b/.test(place)) {
      return "freshwater";
    }
  }

  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  // Gulf of Mexico shelf / Florida west coast / TX–LA–MS–AL inshore.
  if (lat >= 24 && lat <= 31.4 && lon >= -97.9 && lon <= -80.8) {
    return "saltwater-inshore";
  }
  // SE Florida / Gulf Stream.
  if (lat >= 24 && lat <= 28.4 && lon > -80.8 && lon <= -78.8) {
    return "saltwater-offshore";
  }
  // US Atlantic inshore (Carolinas through Mid-Atlantic).
  if (lat >= 25 && lat <= 42 && lon >= -81.6 && lon <= -69.5) {
    return "saltwater-inshore";
  }
  // US Pacific coast.
  if (lat >= 32 && lat <= 49 && lon >= -125.5 && lon <= -116.8) {
    return "saltwater-inshore";
  }
  // Interior Lower 48 — lakes and rivers.
  if (lat >= 24.5 && lat <= 49.5 && lon >= -125 && lon <= -67) {
    return "freshwater";
  }
  return null;
}
