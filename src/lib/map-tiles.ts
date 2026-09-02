export type MapStyle = "satellite" | "street";

export const DEFAULT_MAP_STYLE: MapStyle = "satellite";

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

type TileLayer = {
  addTo: (map: unknown) => unknown;
};

type LayerGroup = {
  addTo: (map: unknown) => unknown;
  remove: () => void;
};

type LeafletLike = {
  tileLayer: (url: string, options: Record<string, unknown>) => TileLayer;
  layerGroup: (layers: TileLayer[]) => LayerGroup;
};

export function addBasemapToMap(
  L: LeafletLike,
  map: unknown,
  style: MapStyle,
  previous?: { remove: () => void } | null,
): LayerGroup {
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
