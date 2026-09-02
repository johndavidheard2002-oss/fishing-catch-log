export type MapStyle = "satellite" | "street";

export const DEFAULT_MAP_STYLE: MapStyle = "satellite";

/**
 * Empty-map starting view: mid–upper Texas Gulf Coast (Galveston–Corpus /
 * Matagorda). Used only when there is no pin yet — a catch with GPS still
 * fits to that point.
 */
export const DEFAULT_MAP_CENTER: [number, number] = [28.55, -96.2];
export const DEFAULT_MAP_ZOOM = 8;

/** Same pixel frame on Spots and Calendar so empty TX-Gulf views match. */
export const DEFAULT_MAP_FRAME_CLASS =
  "h-64 w-full overflow-hidden rounded-2xl border border-line";

/** Esri World Imagery — no API key. Tile scheme is z/y/x. */
export const ESRI_WORLD_IMAGERY_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

/** Place names over imagery so a shoreline pin is still easy to orient. */
export const ESRI_PLACE_LABELS_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

export const OSM_STREET_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export const ESRI_ATTRIBUTION =
  "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";

export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export type MapTileSpec = {
  url: string;
  attribution: string;
  maxZoom: number;
  maxNativeZoom: number;
};

export function mapBasemapSpec(style: MapStyle = DEFAULT_MAP_STYLE): MapTileSpec[] {
  if (style === "street") {
    return [
      {
        url: OSM_STREET_URL,
        attribution: OSM_ATTRIBUTION,
        maxZoom: 19,
        maxNativeZoom: 19,
      },
    ];
  }
  return [
    {
      url: ESRI_WORLD_IMAGERY_URL,
      attribution: ESRI_ATTRIBUTION,
      maxZoom: 19,
      maxNativeZoom: 19,
    },
    {
      url: ESRI_PLACE_LABELS_URL,
      attribution: "",
      maxZoom: 19,
      maxNativeZoom: 19,
    },
  ];
}

export type LeafletNS = typeof import("leaflet");

export async function loadLeaflet(): Promise<LeafletNS> {
  const mod = await import("leaflet");
  return ((mod as { default?: LeafletNS }).default ?? mod) as LeafletNS;
}

export function addBasemapToMap<
  TMap extends object,
  TLayer extends { addTo(map: TMap): unknown },
>(
  L: {
    tileLayer(url: string, options: Record<string, unknown>): TLayer;
    layerGroup(layers: TLayer[]): { addTo(map: TMap): unknown; remove(): void };
  },
  map: TMap,
  style: MapStyle,
  previous?: { remove(): void } | null,
): { addTo(map: TMap): unknown; remove(): void } {
  previous?.remove();
  const layers = mapBasemapSpec(style).map((spec) =>
    L.tileLayer(spec.url, {
      attribution: spec.attribution,
      maxZoom: spec.maxZoom,
      maxNativeZoom: spec.maxNativeZoom,
    }),
  );
  const group = L.layerGroup(layers);
  group.addTo(map);
  return group;
}
