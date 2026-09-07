import type { PlaceSnapshot } from "./types";

export const MIN_TOWN_QUERY_LENGTH = 3;
export const TOWN_LOOKUP_DEBOUNCE_MS = 700;
export const TOWN_MAP_ZOOM = 13;
/** Wider than this is a state/region — center only, do not fit the whole box. */
export const TOWN_MAP_MAX_FIT_SPAN = 1.5;

export type TownBounds = {
  south: number;
  north: number;
  west: number;
  east: number;
};

export type TownGeocodeHit = {
  latitude: number;
  longitude: number;
  label: string;
  boundingBox: TownBounds | null;
};

/** Map camera for a typed town. Never a pin — the angler taps to drop one. */
export type TownMapCenter = {
  latitude: number;
  longitude: number;
  zoom: number;
  bounds: TownBounds | null;
  label: string;
};

export function shouldGeocodeTownQuery(query: string): boolean {
  const q = query.trim();
  if (q.length < MIN_TOWN_QUERY_LENGTH) return false;
  if (/°[NS]/.test(q) && /°[EW]/.test(q)) return false;
  return true;
}

/**
 * Town search may pan an empty map so the angler can drop a pin.
 * A dropped pin locks camera and coordinates — naming must not geocode-move it.
 */
export function shouldLookupTownForMapFocus(query: string, hasPin: boolean): boolean {
  return !hasPin && shouldGeocodeTownQuery(query);
}

/** Apply a town camera only when no pin exists yet. */
export function townMapFocusForName(
  focus: TownMapCenter | null | undefined,
  hasPin: boolean,
): TownMapCenter | null {
  if (!focus || hasPin) return null;
  return focus;
}

export function boundsFromNominatimBox(box: unknown): TownBounds | null {
  if (!Array.isArray(box) || box.length < 4) return null;
  const south = Number(box[0]);
  const north = Number(box[1]);
  const west = Number(box[2]);
  const east = Number(box[3]);
  if (![south, north, west, east].every(Number.isFinite)) return null;
  return { south, north, west, east };
}

export function townHitFromNominatim(data: unknown): TownGeocodeHit | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  const latitude = Number(rec.lat);
  const longitude = Number(rec.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const label =
    (typeof rec.display_name === "string" && rec.display_name.trim()) ||
    (typeof rec.name === "string" && rec.name.trim()) ||
    "";
  return {
    latitude,
    longitude,
    label,
    boundingBox: boundsFromNominatimBox(rec.boundingbox),
  };
}

export function townMapCenterFromHit(hit: TownGeocodeHit): TownMapCenter {
  const box = hit.boundingBox;
  const useBounds =
    box != null &&
    Math.abs(box.north - box.south) <= TOWN_MAP_MAX_FIT_SPAN &&
    Math.abs(box.east - box.west) <= TOWN_MAP_MAX_FIT_SPAN;
  return {
    latitude: hit.latitude,
    longitude: hit.longitude,
    zoom: TOWN_MAP_ZOOM,
    bounds: useBounds ? box : null,
    label: hit.label,
  };
}

export async function geocodeTown(
  query: string,
  fetcher: typeof fetch = fetch,
): Promise<TownMapCenter | null> {
  if (!shouldGeocodeTownQuery(query)) return null;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query.trim());
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");
  try {
    const res = await fetcher(url, {
      headers: {
        "User-Agent": "TideMark/1.0 (logbook)",
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const hit = townHitFromNominatim(await res.json());
    return hit ? townMapCenterFromHit(hit) : null;
  } catch {
    return null;
  }
}

export async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<PlaceSnapshot> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("zoom", "12");

    const res = await fetch(url, {
      headers: {
        "User-Agent": "TideMark/1.0 (logbook)",
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as {
      name?: string;
      display_name?: string;
      address?: {
        water?: string;
        lake?: string;
        river?: string;
        bay?: string;
        hamlet?: string;
        town?: string;
        city?: string;
        village?: string;
        county?: string;
        state?: string;
      };
    };
    const addr = data.address ?? {};
    const water = addr.water || addr.lake || addr.river || addr.bay;
    const locality = addr.hamlet || addr.village || addr.town || addr.city;
    const parts = [water, locality, addr.state].filter(Boolean);
    const placeName =
      parts.join(", ") || data.name || data.display_name?.split("," ).slice(0, 3).join(",") ||
      coordsLabel(lat, lon);

    return {
      placeName,
      source: "nominatim",
      note: "Place name from OpenStreetMap. Edit if you know the hole or ramp.",
    };
  } catch {
    return {
      placeName: coordsLabel(lat, lon),
      source: "coords",
      note: "Could not look up a place name. Coordinates saved; you can name the spot.",
    };
  }
}

export function coordsLabel(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${ns}, ${Math.abs(lon).toFixed(4)}°${ew}`;
}
