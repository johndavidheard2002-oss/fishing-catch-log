import { describe, expect, it } from "vitest";
import { shouldShowForgotLink } from "./forgot-link";

describe("shouldShowForgotLink", () => {
  it("is hidden until a sign-in fails with wrong credentials", () => {
    expect(shouldShowForgotLink({ alreadyShown: false, mode: "signin", status: 401 })).toBe(true);
  });
  it("stays hidden on network errors, rate limits, bad input, and server errors", () => {
    for (const status of [null, 400, 429, 500, 503]) {
      expect(shouldShowForgotLink({ alreadyShown: false, mode: "signin", status })).toBe(false);
    }
  });
  it("ignores Create account failures", () => {
    expect(shouldShowForgotLink({ alreadyShown: false, mode: "create", status: 401 })).toBe(false);
  });
  it("stays shown once revealed", () => {
    expect(shouldShowForgotLink({ alreadyShown: true, mode: "signin", status: null })).toBe(true);
  });
});
