import type { PlaceSnapshot } from "./types";

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
