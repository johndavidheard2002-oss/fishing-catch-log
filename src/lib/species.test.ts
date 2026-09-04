import { describe, expect, it } from "vitest";
import {
  habitatHintFromLocation,
  isSaltwaterCatalogSpecies,
  saltwaterHintFromLocation,
  saltwaterSpecies,
  speciesForHabitat,
} from "./habitat";
import {
  autoFillSpecies,
  formPatchFromSuggestion,
  matchCatalogSpecies,
  matchSaltwaterCatalogSpecies,
  normalizeSpeciesList,
  primarySpecies,
  resolveSpeciesName,
  restrictSuggestionToSaltwater,
  SPECIES_AUTO_FILL_MIN,
  speciesListsOverlap,
} from "./species";
import { demoIdentifySpecies } from "./vision/demo";

describe("matchCatalogSpecies", () => {
  it("maps Gulf common names onto the catalog", () => {
    expect(matchCatalogSpecies("Red drum")).toBe("Redfish");
    expect(matchCatalogSpecies("spotted seatrout")).toBe("Speckled Trout");
    expect(matchCatalogSpecies("dolphin")).toBe("Mahi-mahi");
    expect(matchCatalogSpecies("gray snapper")).toBe("Mangrove Snapper");
  });

  it("prefers the hinted habitat when names overlap", () => {
    expect(resolveSpeciesName("trout", "freshwater")).toBe("Rainbow Trout");
    expect(resolveSpeciesName("trout", "saltwater-inshore")).toBe("Speckled Trout");
  });
});

describe("matchSaltwaterCatalogSpecies", () => {
  it("maps Gulf names and rejects freshwater catalog names", () => {
    expect(matchSaltwaterCatalogSpecies("Red drum")).toBe("Redfish");
    expect(matchSaltwaterCatalogSpecies("trout")).toBe("Speckled Trout");
    expect(matchSaltwaterCatalogSpecies("bass")).toBe("Striped Bass");
    expect(matchSaltwaterCatalogSpecies("Largemouth Bass")).toBeNull();
    expect(matchSaltwaterCatalogSpecies("Rainbow Trout")).toBeNull();
    expect(matchSaltwaterCatalogSpecies("Bluegill")).toBeNull();
    expect(matchSaltwaterCatalogSpecies("walleye")).toBeNull();
    expect(matchSaltwaterCatalogSpecies("Unknown")).toBeNull();
    expect(matchSaltwaterCatalogSpecies("blacktip shark")).toBe("Blacktip");
    expect(matchSaltwaterCatalogSpecies("Bull shark")).toBe("Bull shark");
  });
});

describe("primarySpecies", () => {
  it("stores Unknown when they save without picking a species", () => {
    expect(primarySpecies([])).toBe("Unknown");
    expect(normalizeSpeciesList(null, [])).toEqual([]);
    expect(normalizeSpeciesList("Unknown", [])).toEqual(["Unknown"]);
  });
});

describe("restrictSuggestionToSaltwater", () => {
  it("drops freshwater guesses instead of auto-filling them", () => {
    const cleaned = restrictSuggestionToSaltwater({
      species: "Largemouth Bass",
      confidence: 0.92,
      speciesList: ["Largemouth Bass", "Rainbow Trout", "Redfish"],
      alternatives: [{ species: "Bluegill", confidence: 0.4 }],
      habitat: "freshwater",
      source: "openai",
      note: "test",
    });
    expect(cleaned.species).toBe("Redfish");
    expect(cleaned.speciesList).toEqual(["Redfish"]);
    expect(cleaned.habitat).toBe("saltwater-inshore");
    expect(cleaned.alternatives).toEqual([]);
  });

  it("returns Unknown when nothing in the suggestion is a catalog saltwater fish", () => {
    const cleaned = restrictSuggestionToSaltwater({
      species: "Rainbow Trout",
      confidence: 0.88,
      speciesList: ["Brown Trout"],
      alternatives: [{ species: "Brook Trout", confidence: 0.2 }],
      habitat: "freshwater",
      source: "openai",
      note: "test",
    });
    expect(cleaned.species).toBe("Unknown");
    expect(cleaned.speciesList).toEqual([]);
    expect(cleaned.confidence).toBeLessThan(SPECIES_AUTO_FILL_MIN);
    expect(autoFillSpecies(cleaned)).toBeNull();
  });
});

describe("formPatchFromSuggestion", () => {
  it("auto-fills the top saltwater match at or above the confidence floor", () => {
    const patch = formPatchFromSuggestion({
      species: "Mahi-mahi",
      confidence: 0.72,
      speciesList: ["Mahi-mahi"],
      alternatives: [],
      habitat: "saltwater-offshore",
      source: "openai",
      note: "test",
    });
    expect(patch.speciesList).toEqual(["Mahi-mahi"]);
    expect(patch.speciesSuggested).toBe("Mahi-mahi");
    expect(patch.speciesSource).toBe("vision");
    expect(patch.habitat).toBe("saltwater-offshore");
  });

  it("leaves species blank when confidence is too low", () => {
    const patch = formPatchFromSuggestion({
      species: "Snook",
      confidence: 0.41,
      speciesList: ["Snook"],
      alternatives: [],
      habitat: "saltwater-inshore",
      source: "openai",
      note: "test",
    });
    expect(patch.speciesList).toEqual([]);
    expect(patch.speciesSuggested).toBe("");
    expect(patch.speciesSource).toBe("manual");
  });
});

describe("normalizeSpeciesList", () => {
  it("dedupes and keeps order", () => {
    expect(normalizeSpeciesList("Redfish", ["Redfish", "Speckled Trout", "redfish"])).toEqual([
      "Redfish",
      "Speckled Trout",
    ]);
  });
});

describe("speciesListsOverlap", () => {
  it("matches if any tagged species is shared", () => {
    expect(speciesListsOverlap(["Redfish", "Speckled Trout"], ["Flounder", "Redfish"])).toBe(true);
    expect(speciesListsOverlap(["Redfish"], ["Speckled Trout"])).toBe(false);
  });
});

describe("habitatHintFromLocation", () => {
  it("treats Gulf and lagoon pins as inshore", () => {
    expect(habitatHintFromLocation(28.74, -80.75, "Mosquito Lagoon, FL")).toBe(
      "saltwater-inshore",
    );
    expect(habitatHintFromLocation(29.3, -94.8)).toBe("saltwater-inshore");
  });

  it("treats Gulf Stream as offshore and lakes as freshwater", () => {
    expect(habitatHintFromLocation(25.76, -80.02, "Gulf Stream, FL")).toBe(
      "saltwater-offshore",
    );
    expect(habitatHintFromLocation(30.388, -97.975, "Lake Travis, TX")).toBe("freshwater");
    expect(saltwaterHintFromLocation(30.388, -97.975, "Lake Travis, TX")).toBeNull();
    expect(saltwaterHintFromLocation(25.76, -80.02, "Gulf Stream, FL")).toBe(
      "saltwater-offshore",
    );
  });
});

describe("demoIdentifySpecies", () => {
  it("stays inside the saltwater catalog and never returns freshwater names", () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 9, 8, 7]);
    const inshore = demoIdentifySpecies(bytes, { habitat: "saltwater-inshore" });
    const fresh = demoIdentifySpecies(bytes, { habitat: "freshwater" });
    const salt = saltwaterSpecies();
    expect(salt).toContain(inshore.species);
    expect(isSaltwaterCatalogSpecies(inshore.species)).toBe(true);
    expect(speciesForHabitat("freshwater")).not.toContain(fresh.species);
    expect(fresh.species === "Unknown" || isSaltwaterCatalogSpecies(fresh.species)).toBe(true);
    expect(inshore.note.toLowerCase()).toContain("demo");
    expect(inshore.speciesList?.length).toBeGreaterThan(0);
    expect(autoFillSpecies(inshore)).toBe(inshore.species);
  });

  it("fills a saltwater filename and ignores a freshwater filename", () => {
    const bytes = new Uint8Array([9, 8, 7, 6]);
    const redfish = demoIdentifySpecies(bytes, { fileName: "redfish-slot.jpg" });
    expect(redfish.species).toBe("Redfish");
    expect(redfish.confidence).toBeGreaterThanOrEqual(SPECIES_AUTO_FILL_MIN);
    expect(formPatchFromSuggestion(redfish).speciesList).toEqual(["Redfish"]);

    const bass = demoIdentifySpecies(bytes, { fileName: "largemouth-bass.jpg" });
    expect(bass.species).toBe("Unknown");
    expect(autoFillSpecies(bass)).toBeNull();
    expect(matchSaltwaterCatalogSpecies("Largemouth Bass")).toBeNull();
  });
});
