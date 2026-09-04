import { describe, expect, it } from "vitest";
import {
  DEFAULT_HABITAT,
  duckSpecies,
  habitatLabel,
  inferHabitat,
  isDuckCatalogSpecies,
  isSaltwaterCatalogSpecies,
  isSaltwaterHabitat,
  isSharkCatalogSpecies,
  matchesHabitatFilters,
  saltwaterSpecies,
  sharkSpecies,
  speciesForHabitat,
  waterTypeOf,
} from "./habitat";

describe("DEFAULT_HABITAT", () => {
  it("starts a new catch on saltwater inshore", () => {
    expect(DEFAULT_HABITAT).toBe("saltwater-inshore");
    expect(waterTypeOf(DEFAULT_HABITAT)).toBe("saltwater");
  });
});

describe("inferHabitat", () => {
  it("uses the catalog for known species", () => {
    expect(inferHabitat("Largemouth Bass")).toBe("freshwater");
    expect(inferHabitat("Redfish")).toBe("saltwater-inshore");
    expect(inferHabitat("Mahi-mahi")).toBe("saltwater-offshore");
    expect(inferHabitat("Striped Bass")).toBe("saltwater-inshore");
    expect(inferHabitat("Pintail")).toBe("duck");
    expect(inferHabitat("Bluebill")).toBe("duck");
  });

  it("guesses from common names when not in the catalog", () => {
    expect(inferHabitat("Gulf king mackerel")).toBe("saltwater-offshore");
    expect(inferHabitat("slot redfish")).toBe("saltwater-inshore");
    expect(inferHabitat("pond bluegill")).toBe("freshwater");
    expect(inferHabitat("pentel hen")).toBe("duck");
    expect(inferHabitat("lesser scaup")).toBe("duck");
  });
});

describe("saltwaterSpecies", () => {
  it("lists inshore and offshore names and excludes freshwater bass and trout", () => {
    const salt = saltwaterSpecies();
    expect(salt).toContain("Redfish");
    expect(salt).toContain("Mahi-mahi");
    expect(salt).not.toContain("Largemouth Bass");
    expect(salt).not.toContain("Rainbow Trout");
    expect(isSaltwaterCatalogSpecies("Snook")).toBe(true);
    expect(isSaltwaterCatalogSpecies("Largemouth Bass")).toBe(false);
    expect(salt).not.toContain("Pintail");
    expect(salt).not.toContain("Mallard");
    expect(isSaltwaterCatalogSpecies("Pintail")).toBe(false);
    expect(isSaltwaterCatalogSpecies("Bluebill")).toBe(false);
  });
});

describe("speciesForHabitat", () => {
  it("keeps freshwater, inshore, and offshore lists separate", () => {
    const fresh = speciesForHabitat("freshwater");
    const inshore = speciesForHabitat("saltwater-inshore");
    const offshore = speciesForHabitat("saltwater-offshore");
    expect(fresh).toContain("Largemouth Bass");
    expect(fresh).not.toContain("Redfish");
    expect(inshore).toContain("Snook");
    expect(inshore).not.toContain("Mahi-mahi");
    expect(inshore).not.toContain("Blacktip");
    expect(offshore).toContain("Mahi-mahi");
    expect(offshore).not.toContain("Bluegill");
    expect(offshore).not.toContain("Tiger shark");
    expect(inshore).not.toContain("Pintail");
    expect(offshore).not.toContain("Mallard");
    expect(speciesForHabitat("duck")).toEqual(duckSpecies());
  });
});

describe("sharkSpecies", () => {
  it("lists the Shark tab chips and keeps them saltwater", () => {
    expect(sharkSpecies()).toEqual(["Blacktip", "Bull shark", "Hammerhead", "Tiger shark"]);
    expect(isSharkCatalogSpecies("Bull shark")).toBe(true);
    expect(isSharkCatalogSpecies("Redfish")).toBe(false);
    expect(isSaltwaterCatalogSpecies("Blacktip")).toBe(true);
    expect(isSaltwaterCatalogSpecies("Hammerhead")).toBe(true);
  });
});

describe("duckSpecies", () => {
  it("lists the Duck tab chips in the locked order and keeps them off the saltwater lists", () => {
    expect(duckSpecies()).toEqual([
      "Pintail",
      "Wigeon",
      "Green-winged teal",
      "Blue-winged teal",
      "Cinnamon teal",
      "Redhead",
      "Bufflehead",
      "Shoveler",
      "Mallard",
      "Mottled duck",
      "Gadwall",
      "Canvasback",
      "Bluebill",
      "Wood duck",
    ]);
    expect(duckSpecies()).not.toContain("Ring-necked Duck");
    expect(duckSpecies()).not.toContain("Scaup");
    expect(isDuckCatalogSpecies("Pintail")).toBe(true);
    expect(isDuckCatalogSpecies("Bluebill")).toBe(true);
    expect(isDuckCatalogSpecies("Redfish")).toBe(false);
    expect(isSaltwaterHabitat("duck")).toBe(false);
    expect(habitatLabel("duck")).toBe("Duck");
  });
});

describe("matchesHabitatFilters", () => {
  it("treats saltwater as both inshore and offshore when both are selected", () => {
    expect(matchesHabitatFilters("saltwater-inshore", ["saltwater-inshore", "saltwater-offshore"])).toBe(
      true,
    );
    expect(matchesHabitatFilters("freshwater", ["saltwater-inshore", "saltwater-offshore"])).toBe(
      false,
    );
    expect(matchesHabitatFilters("duck", ["saltwater-inshore", "saltwater-offshore"])).toBe(false);
    expect(matchesHabitatFilters("duck", ["duck"])).toBe(true);
    expect(matchesHabitatFilters("saltwater-inshore", ["duck"])).toBe(false);
  });
});

describe("waterTypeOf", () => {
  it("maps habitats to freshwater or saltwater", () => {
    expect(waterTypeOf("freshwater")).toBe("freshwater");
    expect(waterTypeOf("saltwater-offshore")).toBe("saltwater");
    expect(waterTypeOf("duck")).toBe("freshwater");
  });
});
