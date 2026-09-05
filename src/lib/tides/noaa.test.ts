import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchNoaaExtremes,
  nauticalMilesBetween,
  pickNearestTideStation,
  resetNoaaStationCache,
  type NoaaStation,
} from "./noaa";

const NIIHAU: NoaaStation = {
  id: "1610367",
  name: "Nonopapa, Niihau Island",
  lat: 21.87,
  lng: -160.235,
};

const PORT_ARANSAS: NoaaStation = {
  id: "8775237",
  name: "Port Aransas",
  lat: 27.8397,
  lng: -97.0725,
};

const ROCKPORT: NoaaStation = {
  id: "8774770",
  name: "Rockport",
  lat: 28.0217,
  lng: -97.0467,
};

const LYNCHBURG: NoaaStation = {
  id: "8770733",
  name: "Lynchburg Landing, San Jacinto River",
  lat: 29.7647,
  lng: -95.078,
};

const CATALOG = [NIIHAU, PORT_ARANSAS, ROCKPORT, LYNCHBURG];

afterEach(() => {
  resetNoaaStationCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("pickNearestTideStation", () => {
  it("does not use NOAA catalog order or a missing distance field", () => {
    const pin = { lat: 27.8339, lon: -97.0611 };
    const byBrokenDistance = [...CATALOG].sort(
      (a, b) => (a.distance ?? 999) - (b.distance ?? 999),
    );
    expect(byBrokenDistance[0]?.id).toBe("1610367");

    const picked = pickNearestTideStation(CATALOG, pin.lat, pin.lon);
    expect(picked?.id).toBe("8775237");
    expect(picked?.name).toBe("Port Aransas");
    expect(picked?.distanceNm).toBeLessThan(2);
  });

  it("maps Rockport and Aransas Pass pins to local Texas stations", () => {
    expect(pickNearestTideStation(CATALOG, 28.0206, -97.0544)?.id).toBe("8774770");
    expect(pickNearestTideStation(CATALOG, 27.9095, -97.15)?.id).toBe("8775237");
  });

  it("maps Lynchburg Landing to 8770733, not the Hawaii catalog head", () => {
    expect(pickNearestTideStation(CATALOG, 29.7647, -95.078)?.id).toBe("8770733");
  });

  it("returns null when every station is outside the search radius", () => {
    expect(pickNearestTideStation(CATALOG, 30.2672, -97.7431)).toBeNull();
  });
});

describe("nauticalMilesBetween", () => {
  it("is about 11 nm from Port Aransas to Rockport", () => {
    const nm = nauticalMilesBetween(27.8397, -97.0725, 28.0217, -97.0467);
    expect(nm).toBeGreaterThan(10);
    expect(nm).toBeLessThan(13);
  });
});

describe("fetchNoaaExtremes", () => {
  it("requests MLLW/GMT highs and lows for the nearest station, not the first catalog row", async () => {
    const requested: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        requested.push(url);
        if (url.includes("stations.json")) {
          return new Response(JSON.stringify({ stations: CATALOG }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url.includes("datagetter")) {
          expect(url).toContain("station=8775237");
          expect(url).toContain("datum=MLLW");
          expect(url).toContain("time_zone=gmt");
          expect(url).toContain("interval=hilo");
          expect(url).toContain("units=english");
          expect(url).not.toContain("station=1610367");
          return new Response(
            JSON.stringify({
              predictions: [
                { t: "2026-09-06 10:03", v: "1.526", type: "H" },
                { t: "2026-09-06 23:01", v: "0.053", type: "L" },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    const result = await fetchNoaaExtremes(
      27.8339,
      -97.0611,
      new Date("2026-09-06T12:00:00.000Z"),
    );

    expect(result.stationId).toBe("8775237");
    expect(result.stationName).toBe("Port Aransas");
    expect(result.extremes).toEqual([
      { at: new Date("2026-09-06T10:03:00.000Z"), type: "high", heightFt: 1.526 },
      { at: new Date("2026-09-06T23:01:00.000Z"), type: "low", heightFt: 0.053 },
    ]);
    expect(requested.some((url) => url.includes("stations.json"))).toBe(true);
    expect(requested.some((url) => url.includes("datagetter"))).toBe(true);
  });
});
