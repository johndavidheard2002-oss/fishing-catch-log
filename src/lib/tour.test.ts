import { afterEach, describe, expect, it } from "vitest";
import {
  LEGACY_SETUP_KEY,
  TOUR_KEY,
  TOUR_SCREENS,
  markTourSeen,
  shouldShowTour,
  tourSeen,
  tourStorageKey,
} from "./tour";

const memory = new Map<string, string>();

const fakeStorage = {
  getItem(key: string) {
    return memory.has(key) ? memory.get(key)! : null;
  },
  setItem(key: string, value: string) {
    memory.set(key, value);
  },
  removeItem(key: string) {
    memory.delete(key);
  },
  clear() {
    memory.clear();
  },
  key() {
    return null;
  },
  get length() {
    return memory.size;
  },
} as Storage;

describe("first-sign-in tour", () => {
  afterEach(() => {
    memory.clear();
  });

  it("uses a new key so the old photo-setup flag does not count as done", () => {
    expect(TOUR_KEY).not.toBe(LEGACY_SETUP_KEY);
    Object.defineProperty(globalThis, "localStorage", { value: fakeStorage, configurable: true });
    memory.set(`${LEGACY_SETUP_KEY}:a`, "1");
    expect(tourSeen("a")).toBe(false);
    expect(shouldShowTour({ ready: true, seen: tourSeen("a"), forced: false, signedIn: true })).toBe(true);
  });

  it("starts unseen per journal and stays set after complete or skip", () => {
    Object.defineProperty(globalThis, "localStorage", { value: fakeStorage, configurable: true });
    expect(tourSeen("a")).toBe(false);
    markTourSeen("a");
    expect(tourSeen("a")).toBe(true);
    expect(tourSeen("b")).toBe(false);
    expect(memory.get(tourStorageKey("a"))).toBe("1");
  });

  it("shows after sign-in when unseen, not on later loads, and when Help forces it", () => {
    expect(shouldShowTour({ ready: false, seen: false, forced: false, signedIn: true })).toBe(false);
    expect(shouldShowTour({ ready: true, seen: false, forced: false, signedIn: false })).toBe(false);
    expect(shouldShowTour({ ready: true, seen: false, forced: false, signedIn: undefined })).toBe(false);
    expect(shouldShowTour({ ready: true, seen: false, forced: false, signedIn: true })).toBe(true);
    expect(shouldShowTour({ ready: true, seen: true, forced: false, signedIn: true })).toBe(false);
    expect(shouldShowTour({ ready: true, seen: true, forced: true, signedIn: true })).toBe(true);
    expect(shouldShowTour({ ready: true, seen: true, forced: true, signedIn: false })).toBe(true);
  });

  it("covers the real tabs in a few short screens and says friend, never buddy", () => {
    const titles = TOUR_SCREENS.map((screen) => screen.title);
    expect(titles).toEqual(["Log a catch", "Calendar Log", "Plan a day", "Old photos and friends"]);
    expect(TOUR_SCREENS).toHaveLength(4);
    const text = TOUR_SCREENS.map((screen) => `${screen.title} ${screen.body}`).join(" ");
    expect(text.toLowerCase()).toContain("photo");
    expect(text.toLowerCase()).toContain("pin");
    expect(text).toContain("Calendar");
    expect(text).toContain("List");
    expect(text).toContain("Grid");
    expect(text).toContain("Plan a day");
    expect(text.toLowerCase()).toContain("backfill");
    expect(text.toLowerCase()).toContain("friend");
    expect(text.toLowerCase()).not.toContain("buddy");
    expect(TOUR_SCREENS.every((screen) => screen.body.length < 220)).toBe(true);
  });
});
