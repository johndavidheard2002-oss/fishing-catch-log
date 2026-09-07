import { describe, expect, it, vi } from "vitest";
import {
  boundsFromNominatimBox,
  geocodeTown,
  MIN_TOWN_QUERY_LENGTH,
  shouldGeocodeTownQuery,
  shouldLookupTownForMapFocus,
  TOWN_MAP_ZOOM,
  townHitFromNominatim,
  townMapCenterFromHit,
  townMapFocusForName,
} from "./geocode";

const ROCKPORT = {
  lat: "28.0206",
  lon: "-97.0544",
  display_name: "Rockport, Aransas County, Texas, United States",
  boundingbox: ["27.98", "28.06", "-97.10", "-97.00"],
};

describe("shouldGeocodeTownQuery", () => {
  it("requires a real place name, not coords or a stub", () => {
    expect(MIN_TOWN_QUERY_LENGTH).toBe(3);
    expect(shouldGeocodeTownQuery("Ro")).toBe(false);
    expect(shouldGeocodeTownQuery("   ")).toBe(false);
    expect(shouldGeocodeTownQuery("28.7400°N, 80.7500°W")).toBe(false);
    expect(shouldGeocodeTownQuery("Rockport")).toBe(true);
    expect(shouldGeocodeTownQuery("  Port Aransas, TX  ")).toBe(true);
  });
});

describe("shouldLookupTownForMapFocus", () => {
  it("looks up a town only before a pin exists", () => {
    expect(shouldLookupTownForMapFocus("Rockport", false)).toBe(true);
    expect(shouldLookupTownForMapFocus("Rockport", true)).toBe(false);
    expect(shouldLookupTownForMapFocus("Ro", false)).toBe(false);
    expect(shouldLookupTownForMapFocus("28.7400°N, 80.7500°W", false)).toBe(false);
  });
});

describe("townMapFocusForName", () => {
  it("keeps a typed-town camera and drops it once a pin is down", () => {
    const rockport = townMapCenterFromHit(townHitFromNominatim([ROCKPORT])!);
    expect(townMapFocusForName(rockport, false)).toEqual(rockport);
    expect(townMapFocusForName(rockport, true)).toBeNull();
    expect(townMapFocusForName(null, false)).toBeNull();
    expect(townMapFocusForName(undefined, true)).toBeNull();
  });
});

describe("townHitFromNominatim", () => {
  it("reads the first search hit and its box", () => {
    expect(townHitFromNominatim([ROCKPORT])).toEqual({
      latitude: 28.0206,
      longitude: -97.0544,
      label: "Rockport, Aransas County, Texas, United States",
      boundingBox: { south: 27.98, north: 28.06, west: -97.1, east: -97.0 },
    });
    expect(boundsFromNominatimBox(["nope"])).toBeNull();
    expect(townHitFromNominatim([])).toBeNull();
    expect(townHitFromNominatim({ lat: "x", lon: "y" })).toBeNull();
  });
});

describe("townMapCenterFromHit", () => {
  it("fits a town box and only centers a huge region", () => {
    const town = townMapCenterFromHit(townHitFromNominatim([ROCKPORT])!);
    expect(town.zoom).toBe(TOWN_MAP_ZOOM);
    expect(town.bounds).toEqual({ south: 27.98, north: 28.06, west: -97.1, east: -97.0 });
    expect(town).not.toHaveProperty("pin");

    const texas = townMapCenterFromHit({
      latitude: 31.0,
      longitude: -100.0,
      label: "Texas",
      boundingBox: { south: 25.8, north: 36.5, west: -106.6, east: -93.5 },
    });
    expect(texas.bounds).toBeNull();
    expect(texas.latitude).toBe(31.0);
    expect(texas.zoom).toBe(TOWN_MAP_ZOOM);
  });
});

describe("geocodeTown", () => {
  it("calls Nominatim search and does not invent a pin", async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      expect(String(input)).toContain("nominatim.openstreetmap.org/search");
      expect(String(input)).toContain("q=Rockport");
      expect(String(input)).not.toContain("/reverse");
      return new Response(JSON.stringify([ROCKPORT]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const center = await geocodeTown("Rockport", fetcher as unknown as typeof fetch);
    expect(center).toMatchObject({
      latitude: 28.0206,
      longitude: -97.0544,
      zoom: TOWN_MAP_ZOOM,
    });
    expect(center).not.toHaveProperty("dropPin");
    await expect(geocodeTown("x", fetcher as unknown as typeof fetch)).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
