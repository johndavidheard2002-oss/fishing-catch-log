import { describe, expect, it } from "vitest";
import { parseExifStamp, seasonFromDate, timeOfDayFromCaughtAtInput, timeOfDayFromDate } from "./time";

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

describe("timeOfDayFromCaughtAtInput", () => {
  it("uses the datetime-local clock, not Date UTC parsing", () => {
    expect(timeOfDayFromCaughtAtInput("2025-07-12T06:10")).toBe("dawn");
    expect(timeOfDayFromCaughtAtInput("2025-07-12T08:00")).toBe("morning");
    expect(timeOfDayFromCaughtAtInput("2025-07-12T14:30")).toBe("afternoon");
    expect(timeOfDayFromCaughtAtInput("2025-07-12T18:05")).toBe("dusk");
    expect(timeOfDayFromCaughtAtInput("2025-07-12T22:00")).toBe("night");
  });
});

describe("parseExifStamp", () => {
  it("accepts Date objects and EXIF-style strings", () => {
    const fromDate = parseExifStamp(new Date(2025, 6, 12, 6, 10));
    expect(fromDate && timeOfDayFromDate(fromDate)).toBe("dawn");
    const fromString = parseExifStamp("2025:07:12 06:10:00");
    expect(fromString).toBeInstanceOf(Date);
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
