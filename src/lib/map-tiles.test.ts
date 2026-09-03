import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_FRAME_CLASS,
  DEFAULT_MAP_STYLE,
  DEFAULT_MAP_ZOOM,
  ESRI_ATTRIBUTION,
  ESRI_WORLD_IMAGERY_URL,
  OSM_STREET_URL,
  SELECTED_PIN_ZOOM,
  addBasemapToMap,
  mapBasemapSpec,
  mapCamera,
} from "./map-tiles";

describe("default map view", () => {
  it("frames San Antonio (upper-left) and Houston (upper-right) on the TX Gulf", () => {
    const [lat, lng] = DEFAULT_MAP_CENTER;
    expect(lat).toBeGreaterThan(28.9);
    expect(lat).toBeLessThan(29.4);
    expect(lng).toBeGreaterThan(-97.2);
    expect(lng).toBeLessThan(-96.5);
    expect(DEFAULT_MAP_ZOOM).toBe(7);
    expect(DEFAULT_MAP_FRAME_CLASS).toContain("h-64");
  });
});

describe("mapCamera", () => {
  const texasCoast: [number, number] = [28.45, -96.4];
  const houston: [number, number] = [29.76, -95.37];
  const miami: [number, number] = [25.76, -80.19];
  const ohio: [number, number] = [40.21, -82.89];

  it("opens the Texas Gulf frame when empty or in overview mode", () => {
    expect(mapCamera({ pins: [] })).toEqual({
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
      fitPins: null,
    });
    expect(mapCamera({ pins: [texasCoast, miami, ohio], overview: true })).toEqual({
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
      fitPins: null,
    });
  });

  it("zooms to a focused pin instead of fitting every distant marker", () => {
    expect(
      mapCamera({ pins: [texasCoast, miami], selected: texasCoast, overview: true }),
    ).toEqual({ center: texasCoast, zoom: SELECTED_PIN_ZOOM, fitPins: null });
  });

  it("does not fitBounds a worldwide pin set", () => {
    expect(mapCamera({ pins: [texasCoast, miami, ohio] })).toEqual({
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
      fitPins: null,
    });
  });

  it("fits a tight local cluster on Calendar-style maps", () => {
    const camera = mapCamera({ pins: [texasCoast, houston] });
    expect(camera.fitPins).toEqual([texasCoast, houston]);
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
