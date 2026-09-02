import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_FRAME_CLASS,
  DEFAULT_MAP_STYLE,
  DEFAULT_MAP_ZOOM,
  ESRI_ATTRIBUTION,
  ESRI_WORLD_IMAGERY_URL,
  OSM_STREET_URL,
  addBasemapToMap,
  mapBasemapSpec,
} from "./map-tiles";

describe("default map view", () => {
  it("frames San Antonio (upper-left) and Houston (upper-right) on the TX Gulf", () => {
    const [lat, lng] = DEFAULT_MAP_CENTER;
    expect(lat).toBeGreaterThan(28.6);
    expect(lat).toBeLessThan(29.4);
    expect(lng).toBeGreaterThan(-97.4);
    expect(lng).toBeLessThan(-96.4);
    expect(DEFAULT_MAP_ZOOM).toBe(7);
    expect(DEFAULT_MAP_FRAME_CLASS).toContain("h-64");
  });
});

describe("mapBasemapSpec", () => {
  it("defaults to Esri satellite imagery with no API key", () => {
    expect(DEFAULT_MAP_STYLE).toBe("satellite");
    const satellite = mapBasemapSpec();
    expect(satellite[0].url).toBe(ESRI_WORLD_IMAGERY_URL);
    expect(satellite[0].url).toContain("{z}/{y}/{x}");
    expect(satellite[0].url).not.toMatch(/apikey|token=/i);
    expect(satellite[0].attribution).toBe(ESRI_ATTRIBUTION);
    expect(satellite[0].attribution).toMatch(/Esri/);
    expect(satellite.length).toBe(2);
  });

  it("offers OSM streets as the alternate", () => {
    const street = mapBasemapSpec("street");
    expect(street).toHaveLength(1);
    expect(street[0].url).toBe(OSM_STREET_URL);
    expect(street[0].attribution).toMatch(/OpenStreetMap/);
  });
});

describe("addBasemapToMap", () => {
  it("replaces the previous layer group", () => {
    const added: string[] = [];
    let removed = 0;
    const L = {
      tileLayer: (url: string) => {
        added.push(url);
        return { addTo: () => ({}) };
      },
      layerGroup: () => ({
        addTo: () => ({}),
        remove: () => {
          removed += 1;
        },
      }),
    };
    const first = addBasemapToMap(L, {}, "satellite");
    addBasemapToMap(L, {}, "street", first);
    expect(removed).toBe(1);
    expect(added[0]).toBe(ESRI_WORLD_IMAGERY_URL);
    expect(added.at(-1)).toBe(OSM_STREET_URL);
  });
});
