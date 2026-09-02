import { describe, expect, it } from "vitest";
import {
  degreesToWindDirection,
  windDirectionDistance,
  windMatchesCardinal,
} from "./wind";

describe("degreesToWindDirection", () => {
  it("maps degrees onto the 16-point compass", () => {
    expect(degreesToWindDirection(0)).toBe("N");
    expect(degreesToWindDirection(90)).toBe("E");
    expect(degreesToWindDirection(180)).toBe("S");
    expect(degreesToWindDirection(270)).toBe("W");
    expect(degreesToWindDirection(22)).toBe("NNE");
    expect(degreesToWindDirection(359)).toBe("N");
  });
});

describe("windDirectionDistance", () => {
  it("treats the compass as a ring", () => {
    expect(windDirectionDistance("N", "NNE")).toBe(1);
    expect(windDirectionDistance("N", "NNW")).toBe(1);
    expect(windDirectionDistance("N", "S")).toBe(8);
  });
});

describe("windMatchesCardinal", () => {
  it("includes adjacent 16-point bearings", () => {
    expect(windMatchesCardinal("NNE", "N")).toBe(true);
    expect(windMatchesCardinal("SE", "SE")).toBe(true);
    expect(windMatchesCardinal("W", "E")).toBe(false);
  });
});
