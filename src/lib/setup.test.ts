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

  it("starts unseen per journal and stays set after complete or skip", () => {
    Object.defineProperty(globalThis, "localStorage", { value: fakeStorage, configurable: true });
    expect(setupSeen("a")).toBe(false);
    markSetupSeen("a");
    expect(setupSeen("a")).toBe(true);
    expect(setupSeen("b")).toBe(false);
    expect(memory.get(`${SETUP_KEY}:a`)).toBe("1");
  });

  it("shows the first-run dialog only after client read, when unseen or forced", () => {
    expect(shouldShowFirstRun({ ready: false, seen: false, forced: false, hasJournal: true })).toBe(false);
    expect(shouldShowFirstRun({ ready: true, seen: false, forced: false, hasJournal: false })).toBe(false);
    expect(shouldShowFirstRun({ ready: true, seen: false, forced: false, hasJournal: true })).toBe(true);
    expect(shouldShowFirstRun({ ready: true, seen: true, forced: false, hasJournal: true })).toBe(false);
    expect(shouldShowFirstRun({ ready: true, seen: true, forced: true, hasJournal: true })).toBe(true);
  });
});
