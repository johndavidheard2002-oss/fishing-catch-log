import { describe, expect, it } from "vitest";
import { moonForDate } from "./moon";

describe("moonForDate", () => {
  it("is New at the reference new moon", () => {
    const m = moonForDate(new Date("2000-01-06T18:14:00.000Z"));
    expect(m.phase).toBe("New");
    expect(m.illumination).toBeLessThan(5);
  });

  it("is Full about half a synodic month later", () => {
    const m = moonForDate(new Date("2000-01-21T10:40:00.000Z"));
    expect(m.phase).toBe("Full");
    expect(m.illumination).toBeGreaterThan(90);
  });

  it("returns an illumination between 0 and 100", () => {
    const m = moonForDate(new Date("2025-07-12T20:40:00.000Z"));
    expect(m.illumination).toBeGreaterThanOrEqual(0);
    expect(m.illumination).toBeLessThanOrEqual(100);
    expect(m.phase.length).toBeGreaterThan(2);
  });
});
