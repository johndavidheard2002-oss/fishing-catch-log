import { describe, expect, it } from "vitest";
import { habitatHintFromLocation, speciesForHabitat } from "./habitat";
import { matchCatalogSpecies, normalizeSpeciesList, resolveSpeciesName, speciesListsOverlap } from "./species";
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
  });
});

describe("demoIdentifySpecies", () => {
  it("stays inside the habitat list instead of mixing FW and salt", () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 9, 8, 7]);
    const inshore = demoIdentifySpecies(bytes, { habitat: "saltwater-inshore" });
    const fresh = demoIdentifySpecies(bytes, { habitat: "freshwater" });
    expect(speciesForHabitat("saltwater-inshore")).toContain(inshore.species);
    expect(speciesForHabitat("freshwater")).toContain(fresh.species);
    expect(inshore.note.toLowerCase()).toContain("demo");
    expect(inshore.confidence).toBeLessThan(0.5);
    expect(fresh.confidence).toBeLessThan(0.5);
    expect(inshore.speciesList?.length).toBeGreaterThan(0);
  });
});
