import { describe, expect, it } from "vitest";
import {
  DEFAULT_HABITAT,
  inferHabitat,
  isSaltwaterCatalogSpecies,
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
  });

  it("guesses from common names when not in the catalog", () => {
    expect(inferHabitat("Gulf king mackerel")).toBe("saltwater-offshore");
    expect(inferHabitat("slot redfish")).toBe("saltwater-inshore");
    expect(inferHabitat("pond bluegill")).toBe("freshwater");
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

describe("matchesHabitatFilters", () => {
  it("treats saltwater as both inshore and offshore when both are selected", () => {
    expect(matchesHabitatFilters("saltwater-inshore", ["saltwater-inshore", "saltwater-offshore"])).toBe(
      true,
    );
    expect(matchesHabitatFilters("freshwater", ["saltwater-inshore", "saltwater-offshore"])).toBe(
      false,
    );
  });
});

describe("waterTypeOf", () => {
  it("maps habitats to freshwater or saltwater", () => {
    expect(waterTypeOf("freshwater")).toBe("freshwater");
    expect(waterTypeOf("saltwater-offshore")).toBe("saltwater");
  });
});
