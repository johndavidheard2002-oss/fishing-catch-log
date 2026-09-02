import { describe, expect, it } from "vitest";
import { demoDetectFish } from "./detect";

describe("demoDetectFish", () => {
  it("treats catch-like filenames as fish and screenshots as not", () => {
    const bytes = new Uint8Array([9, 8, 7, 6]);
    expect(demoDetectFish(bytes, "redfish-slot.jpg").isFish).toBe(true);
    expect(demoDetectFish(bytes, "screenshot.png").isFish).toBe(false);
  });
});
