import { describe, expect, it } from "vitest";
import { seasonFromDate, timeOfDayFromDate } from "./time";

describe("timeOfDayFromDate", () => {
  it("buckets local hours into dawn through night", () => {
    const at = (h: number, m = 0) => {
      const d = new Date(2025, 6, 12, h, m, 0);
      return timeOfDayFromDate(d);
    };
    expect(at(5, 30)).toBe("dawn");
    expect(at(8)).toBe("morning");
    expect(at(14)).toBe("afternoon");
    expect(at(18)).toBe("dusk");
    expect(at(22)).toBe("night");
    expect(at(2)).toBe("night");
  });
});

describe("seasonFromDate", () => {
  it("uses meteorological northern-hemisphere seasons", () => {
    expect(seasonFromDate(new Date(2025, 3, 18))).toBe("spring");
    expect(seasonFromDate(new Date(2025, 6, 12))).toBe("summer");
    expect(seasonFromDate(new Date(2025, 9, 3))).toBe("fall");
    expect(seasonFromDate(new Date(2025, 0, 12))).toBe("winter");
  });
});
