import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PLAN_DAY_TIDE_PIN_STORAGE_KEY,
  parsePlanDayTidePin,
  planDayTidePinKey,
  planDayTideStation,
  plannedTidePinFromDayPin,
  readPlanDayTidePin,
  readPlanDayTidePins,
  seedPlanDayTidePin,
  writePlanDayTidePin,
} from "./plan-tide-pin";

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    store,
  };
}

describe("plan day tide pin", () => {
  it("parses a dropped pin and prefers it over a planned-spot station", () => {
    expect(parsePlanDayTidePin({ latitude: 27.877, longitude: -97.211, placeName: "Ingleside" })).toEqual({
      latitude: 27.877,
      longitude: -97.211,
      placeName: "Ingleside",
    });
    expect(parsePlanDayTidePin({ latitude: "nope", longitude: -97.211 })).toBeNull();
    const stored = { latitude: 27.84, longitude: -97.05, placeName: "Mud island" };
    const spot = {
      latitude: 28.41,
      longitude: -80.63,
      habitat: "saltwater-inshore" as const,
      caughtAt: null,
      tideHeightFt: null,
      tide: null,
    };
    expect(planDayTideStation(stored, spot)).toEqual(plannedTidePinFromDayPin(stored));
    expect(planDayTideStation(null, spot)).toEqual(spot);
    expect(planDayTideStation(null, null)).toBeNull();
    expect(seedPlanDayTidePin(null, spot)).toEqual({
      latitude: 28.41,
      longitude: -80.63,
      placeName: null,
    });
    expect(planDayTidePinKey(stored)).toBe("27.8400,-97.0500");
  });

  it("remembers a pin per plan day so continuing that day keeps the tide station", () => {
    const storage = memoryStorage();
    expect(readPlanDayTidePin("2026-09-19", storage)).toBeNull();
    writePlanDayTidePin(
      "2026-09-19",
      { latitude: 27.877, longitude: -97.211, placeName: "Enbridge, Ingleside" },
      storage,
    );
    expect(readPlanDayTidePin("2026-09-19", storage)).toEqual({
      latitude: 27.877,
      longitude: -97.211,
      placeName: "Enbridge, Ingleside",
    });
    expect(readPlanDayTidePin("2026-09-20", storage)).toBeNull();
    expect(readPlanDayTidePins(storage)["2026-09-19"]?.placeName).toBe("Enbridge, Ingleside");
    expect(storage.store.get(PLAN_DAY_TIDE_PIN_STORAGE_KEY)).toContain("27.877");
    writePlanDayTidePin("2026-09-19", null, storage);
    expect(readPlanDayTidePin("2026-09-19", storage)).toBeNull();
    writePlanDayTidePin("not-a-day", { latitude: 1, longitude: 2 }, storage);
    expect(readPlanDayTidePins(storage)).toEqual({});
  });
});

describe("Plan calendar opens a map to pin tides", () => {
  it("wires date tap to a map overlay that loads that day’s tides at the pin", () => {
    const plan = readFileSync(resolve(__dirname, "../components/PlanClient.tsx"), "utf8");
    const sheet = readFileSync(resolve(__dirname, "../components/PlanDayMapSheet.tsx"), "utf8");
    expect(plan).toContain("onClick={() => onSelectDay(cell.date)}");
    expect(plan).toContain("setMapDay(picked.day)");
    expect(plan).toContain("PlanDayMapSheet");
    expect(plan).toContain("planDayTideStation");
    expect(plan).toContain("writePlanDayTidePin");
    expect(plan).toContain("readPlanDayTidePins");
    expect(plan).toContain('data-testid="plan-day-map-open"');
    expect(sheet).toContain('data-testid="plan-day-map"');
    expect(sheet).toContain('data-testid="plan-day-map-tides"');
    expect(sheet).toContain("MapPicker");
    expect(sheet).toContain("AreaNamePicker");
    expect(sheet).toContain("useTownMapFocus");
    expect(sheet).toContain("/api/assist/place");
    expect(plan).toContain("stationKey");
    expect(plan).not.toContain("if (!selectedDay || !spotsOnDay.length)");
  });
});
