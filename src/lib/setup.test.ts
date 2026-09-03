import { afterEach, describe, expect, it } from "vitest";
import { SETUP_KEY, markSetupSeen, setupSeen, shouldShowFirstRun } from "./setup";

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

describe("setup seen flag", () => {
  afterEach(() => {
    memory.clear();
  });

  it("starts unseen and stays set after complete or skip", () => {
    Object.defineProperty(globalThis, "localStorage", { value: fakeStorage, configurable: true });
    expect(setupSeen()).toBe(false);
    markSetupSeen();
    expect(setupSeen()).toBe(true);
    expect(memory.get(SETUP_KEY)).toBe("1");
  });

  it("shows the first-run dialog only after client read, when unseen or forced", () => {
    expect(shouldShowFirstRun({ ready: false, seen: false, forced: false })).toBe(false);
    expect(shouldShowFirstRun({ ready: true, seen: false, forced: false })).toBe(true);
    expect(shouldShowFirstRun({ ready: true, seen: true, forced: false })).toBe(false);
    expect(shouldShowFirstRun({ ready: true, seen: true, forced: true })).toBe(true);
  });
});
