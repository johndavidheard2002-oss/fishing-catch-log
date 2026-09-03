import { describe, expect, it } from "vitest";
import { hasSavedPin, targetFromCatch } from "./location-map";
import { catchOf } from "./testing";

describe("location map targets", () => {
  it("builds a zoomed catch target when GPS exists", () => {
    const record = catchOf({ id: "c1", latitude: 28.45, longitude: -96.4 });
    const target = targetFromCatch(record);
    expect(hasSavedPin(target.latitude, target.longitude)).toBe(true);
    expect(target.spots).toHaveLength(1);
    expect(target.spots[0]?.latitude).toBe(28.45);
    expect(target.href).toBe("/catch/c1");
  });

  it("leaves the pin list empty when a catch has no GPS", () => {
    const record = catchOf({ id: "c2", latitude: null, longitude: null, placeName: "Unknown water" });
    const target = targetFromCatch(record);
    expect(hasSavedPin(target.latitude, target.longitude)).toBe(false);
    expect(target.spots).toEqual([]);
    expect(target.place).toMatch(/Unknown water/i);
  });
});
