import { describe, expect, it } from "vitest";
import { areaNameKey, mergeNamedAreas, parseAreaName, parseNamedAreaInput } from "./areas";
import type { NamedArea } from "./types";

function area(partial: Partial<NamedArea> & { name: string }): NamedArea {
  return {
    id: partial.id ?? null,
    anglerId: "a1",
    latitude: null,
    longitude: null,
    source: "catch",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...partial,
  };
}

describe("parseAreaName", () => {
  it("trims, collapses spaces, and caps length", () => {
    expect(parseAreaName("  Mosquito  Lagoon  ")).toBe("Mosquito Lagoon");
    expect(parseAreaName("   ")).toBeNull();
    expect(parseAreaName(12)).toBeNull();
    expect(parseAreaName("x".repeat(90))?.length).toBe(80);
  });
});

describe("parseNamedAreaInput", () => {
  it("requires a name and keeps a coordinate pair together", () => {
    expect(parseNamedAreaInput({ name: "  " })).toBeNull();
    expect(parseNamedAreaInput({ name: "The Point" })).toEqual({
      name: "The Point",
      latitude: null,
      longitude: null,
    });
    expect(
      parseNamedAreaInput({ name: "The Point", latitude: 28.74, longitude: -80.75 }),
    ).toEqual({
      name: "The Point",
      latitude: 28.74,
      longitude: -80.75,
    });
    expect(
      parseNamedAreaInput({ name: "The Point", latitude: 28.74, longitude: "nope" }),
    ).toEqual({
      name: "The Point",
      latitude: null,
      longitude: null,
    });
  });
});

describe("mergeNamedAreas", () => {
  it("lets a saved name win and keeps last known coordinates", () => {
    const merged = mergeNamedAreas(
      [
        area({
          id: "saved-1",
          name: "Mosquito Lagoon",
          source: "saved",
          latitude: 28.74,
          longitude: -80.75,
          updatedAt: "2026-09-02T12:00:00.000Z",
        }),
      ],
      [
        area({
          name: "mosquito lagoon",
          latitude: 28.8,
          longitude: -80.7,
          updatedAt: "2026-09-03T12:00:00.000Z",
        }),
        area({
          name: "Haulover Canal",
          latitude: 28.735,
          longitude: -80.754,
          updatedAt: "2026-08-01T00:00:00.000Z",
        }),
      ],
    );
    expect(merged.map((a) => a.name)).toEqual(["Mosquito Lagoon", "Haulover Canal"]);
    expect(merged[0].id).toBe("saved-1");
    expect(merged[0].latitude).toBe(28.74);
    expect(areaNameKey("Mosquito  Lagoon")).toBe("mosquito lagoon");
  });
});
