import { describe, expect, it } from "vitest";
import { authGate, isPublicPagePath, isPublicPath } from "./auth-gate";

describe("auth gate", () => {
  it("lets signed-out visitors reach sign-in, privacy, and auth APIs only", () => {
    expect(isPublicPath("/signin")).toBe(true);
    expect(isPublicPath("/privacy")).toBe(true);
    expect(isPublicPath("/api/auth/login")).toBe(true);
    expect(isPublicPath("/api/auth/register")).toBe(true);
    expect(isPublicPath("/api/me")).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/calendar")).toBe(false);
    expect(isPublicPath("/api/catches")).toBe(false);
    expect(authGate({ pathname: "/", hasSession: false })).toEqual({
      action: "redirect",
      to: "/signin",
    });
    expect(authGate({ pathname: "/calendar", hasSession: false })).toEqual({
      action: "redirect",
      to: "/signin",
    });
    expect(authGate({ pathname: "/api/catches", hasSession: false })).toEqual({
      action: "unauthorized",
    });
    expect(authGate({ pathname: "/signin", hasSession: false })).toEqual({ action: "next" });
    expect(authGate({ pathname: "/privacy", hasSession: false })).toEqual({ action: "next" });
    expect(authGate({ pathname: "/api/auth/login", hasSession: false })).toEqual({
      action: "next",
    });
  });

  it("lets a session into the app and sends /signin back home", () => {
    expect(isPublicPagePath("/privacy")).toBe(true);
    expect(isPublicPagePath("/")).toBe(false);
    expect(authGate({ pathname: "/", hasSession: true })).toEqual({ action: "next" });
    expect(authGate({ pathname: "/privacy", hasSession: true })).toEqual({ action: "next" });
    expect(authGate({ pathname: "/calendar", hasSession: true })).toEqual({ action: "next" });
    expect(authGate({ pathname: "/signin", hasSession: true })).toEqual({
      action: "redirect",
      to: "/",
    });
  });
});
