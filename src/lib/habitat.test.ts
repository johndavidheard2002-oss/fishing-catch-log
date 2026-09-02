import { describe, expect, it } from "vitest";
import {
  DEFAULT_HABITAT,
  inferHabitat,
  matchesHabitatFilters,
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

describe("speciesForHabitat", () => {
  it("keeps freshwater, inshore, and offshore lists separate", () => {
    const fresh = speciesForHabitat("freshwater");
    const inshore = speciesForHabitat("saltwater-inshore");
    const offshore = speciesForHabitat("saltwater-offshore");
    expect(fresh).toContain("Largemouth Bass");
    expect(fresh).not.toContain("Redfish");
    expect(inshore).toContain("Snook");
    expect(inshore).not.toContain("Mahi-mahi");
    expect(offshore).toContain("Mahi-mahi");
    expect(offshore).not.toContain("Bluegill");
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
