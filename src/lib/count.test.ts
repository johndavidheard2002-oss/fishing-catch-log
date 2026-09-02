import { describe, expect, it } from "vitest";
import { clampFishCount, fishCountLabel } from "./count";

describe("clampFishCount", () => {
  it("defaults to the tagged-species count when empty", () => {
    expect(clampFishCount(null)).toBe(1);
    expect(clampFishCount(undefined, 2)).toBe(2);
    expect(clampFishCount("0", 3)).toBe(3);
  });

  it("clamps to 1–99 and never below species count", () => {
    expect(clampFishCount(4, 2)).toBe(4);
    expect(clampFishCount(1, 3)).toBe(3);
    expect(clampFishCount(200)).toBe(99);
  });
});

describe("fishCountLabel", () => {
  it("pluralizes", () => {
    expect(fishCountLabel(1)).toBe("1 fish");
    expect(fishCountLabel(4)).toBe("4 fish");
  });
});
