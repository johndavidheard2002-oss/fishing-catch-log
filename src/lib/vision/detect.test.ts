import { describe, expect, it } from "vitest";
import { demoDetectFish } from "./detect";

describe("demoDetectFish", () => {
  it("treats catch-like filenames as fish and screenshots as not", () => {
    const bytes = new Uint8Array([9, 8, 7, 6]);
    expect(demoDetectFish(bytes, "redfish-slot.jpg").isFish).toBe(true);
    expect(demoDetectFish(bytes, "snook.jpg").isFish).toBe(true);
    expect(demoDetectFish(bytes, "pintail-marsh.jpg").isFish).toBe(true);
    expect(demoDetectFish(bytes, "mallard.jpg").isFish).toBe(true);
    expect(demoDetectFish(bytes, "screenshot.png").isFish).toBe(false);
    expect(demoDetectFish(bytes, "screenshot_2024.jpg").isFish).toBe(false);
  });

  it("marks unlikely photos without implying they were discarded", () => {
    const note = demoDetectFish(new Uint8Array([9, 8, 7, 6]), "screenshot.png").note;
    expect(note.toLowerCase()).toContain("unlikely");
    expect(note.toLowerCase()).not.toContain("skipped");
  });
});
