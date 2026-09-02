import { describe, expect, it } from "vitest";
import { catchInputFromUnknown } from "./parse";

describe("catchInputFromUnknown time of day", () => {
  it("keeps an explicit bucket from the client", () => {
    const input = catchInputFromUnknown({
      species: "Largemouth Bass",
      caughtAt: "2025-07-12T11:10:00.000Z",
      timeOfDay: "dawn",
    });
    expect(input.timeOfDay).toBe("dawn");
  });

  it("derives dawn from a datetime-local photo clock when the bucket is omitted", () => {
    const input = catchInputFromUnknown({
      species: "Largemouth Bass",
      caughtAt: "2025-07-12T06:10",
    });
    expect(input.timeOfDay).toBe("dawn");
    expect(input.season).toBe("summer");
  });
});
