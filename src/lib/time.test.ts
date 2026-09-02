import { describe, expect, it } from "vitest";
import {
  datetimeLocalFromDate,
  datetimeLocalValue,
  formatTimeOnly,
  isoFromDatetimeLocal,
  parseExifStamp,
  seasonFromDate,
  timeOfDayFromCaughtAtInput,
  timeOfDayFromDate,
} from "./time";

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

  it("does not treat a Zulu ISO hour as a datetime-local wall clock", () => {
    const utcAfternoon = timeOfDayFromCaughtAtInput("2025-07-12T18:00:00.000Z");
    const fromDate = timeOfDayFromDate(new Date("2025-07-12T18:00:00.000Z"));
    expect(utcAfternoon).toBe(fromDate);
  });
});

describe("parseExifStamp", () => {
  it("reads EXIF naive clocks as local wall time", () => {
    const stamp = parseExifStamp("2025:07:12 06:10:00");
    expect(stamp).toBeInstanceOf(Date);
    expect(stamp?.getFullYear()).toBe(2025);
    expect(stamp?.getMonth()).toBe(6);
    expect(stamp?.getDate()).toBe(12);
    expect(stamp?.getHours()).toBe(6);
    expect(stamp?.getMinutes()).toBe(10);
    expect(stamp && timeOfDayFromDate(stamp)).toBe("dawn");
  });

  it("accepts Date objects", () => {
    const fromDate = parseExifStamp(new Date(2025, 6, 12, 6, 10));
    expect(fromDate && timeOfDayFromDate(fromDate)).toBe("dawn");
  });

  it("still parses ISO instants with a timezone", () => {
    const stamp = parseExifStamp("2025-07-12T11:10:00.000Z");
    expect(stamp && !Number.isNaN(stamp.getTime())).toBe(true);
  });
});

describe("isoFromDatetimeLocal", () => {
  it("round-trips a dawn clock without shifting the displayed local time", () => {
    const iso = isoFromDatetimeLocal("2025-07-12T06:10");
    expect(datetimeLocalValue(iso).startsWith("2025-07-12T06:10")).toBe(true);
    expect(timeOfDayFromCaughtAtInput("2025-07-12T06:10")).toBe("dawn");
    expect(formatTimeOnly(iso)).toMatch(/6:10/);
  });
});

describe("EXIF clock display", () => {
  it("shows the camera wall clock, not a UTC-shifted morning/afternoon label", () => {
    const stamp = parseExifStamp("2025:07:12 06:10:00");
    expect(stamp).toBeInstanceOf(Date);
    const local = datetimeLocalFromDate(stamp!);
    expect(local).toBe("2025-07-12T06:10");
    const iso = isoFromDatetimeLocal(local);
    expect(formatTimeOnly(iso)).toMatch(/6:10/);
    expect(timeOfDayFromCaughtAtInput(local)).toBe("dawn");
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
