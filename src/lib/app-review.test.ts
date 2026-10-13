import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  STORE_REVIEW_FLAG,
  countOwnCatches,
  maybeRequestReviewAfterFirstCatchSave,
  resetStoreReviewForTests,
  type ReviewStorage,
} from "./app-review";

function memoryStorage(initial: Record<string, string> = {}): ReviewStorage & { snapshot(): Record<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
    snapshot() {
      return Object.fromEntries(data);
    },
  };
}

afterEach(() => {
  resetStoreReviewForTests();
});

describe("first-catch App Store review", () => {
  it("counts only the signed-in angler's catches", () => {
    expect(
      countOwnCatches(
        [
          { anglerId: "sam" },
          { anglerId: "pat" },
          { anglerId: "sam" },
        ],
        "sam",
      ),
    ).toBe(2);
    expect(countOwnCatches(undefined, "sam")).toBeNull();
  });

  it("asks once after the first catch on native iOS and then stays quiet", async () => {
    const storage = memoryStorage();
    const calls: string[] = [];
    await maybeRequestReviewAfterFirstCatchSave({
      viewerId: "sam",
      ownCatchCount: 1,
      storage,
      nativeIos: true,
      requestReview: async () => {
        calls.push("review");
      },
    });
    expect(calls).toEqual(["review"]);
    expect(storage.getItem(STORE_REVIEW_FLAG)).toBe("1");

    await maybeRequestReviewAfterFirstCatchSave({
      viewerId: "sam",
      ownCatchCount: 2,
      storage,
      nativeIos: true,
      requestReview: async () => {
        calls.push("again");
      },
    });
    expect(calls).toEqual(["review"]);
  });

  it("does not ask when the angler already has catches", async () => {
    const storage = memoryStorage();
    let called = false;
    await maybeRequestReviewAfterFirstCatchSave({
      viewerId: "sam",
      ownCatchCount: 4,
      storage,
      nativeIos: true,
      requestReview: async () => {
        called = true;
      },
    });
    expect(called).toBe(false);
    expect(storage.getItem(STORE_REVIEW_FLAG)).toBe("1");
  });

  it("is a no-op on the website, including when the method would throw", async () => {
    const storage = memoryStorage();
    let fetched = false;
    await maybeRequestReviewAfterFirstCatchSave({
      viewerId: "sam",
      ownCatchCount: 1,
      storage,
      nativeIos: false,
      fetchImpl: async () => {
        fetched = true;
        return new Response("no");
      },
      requestReview: async () => {
        throw new Error("missing");
      },
    });
    expect(fetched).toBe(false);
    expect(storage.snapshot()).toEqual({});
  });

  it("remembers the first catch when the binary has no requestReview method", async () => {
    const storage = memoryStorage();
    await maybeRequestReviewAfterFirstCatchSave({
      viewerId: "sam",
      ownCatchCount: 1,
      storage,
      nativeIos: true,
      requestReview: null,
    });
    expect(storage.getItem(STORE_REVIEW_FLAG)).toBe("pending");

    await maybeRequestReviewAfterFirstCatchSave({
      viewerId: "sam",
      ownCatchCount: 1,
      storage,
      nativeIos: true,
      requestReview: async () => {
        throw new Error("UNIMPLEMENTED");
      },
    });
    expect(storage.getItem(STORE_REVIEW_FLAG)).toBe("pending");

    let called = false;
    await maybeRequestReviewAfterFirstCatchSave({
      viewerId: "sam",
      ownCatchCount: 3,
      storage,
      nativeIos: true,
      requestReview: async () => {
        called = true;
      },
    });
    expect(called).toBe(true);
    expect(storage.getItem(STORE_REVIEW_FLAG)).toBe("1");
  });

  it("does not fetch or ask again after the flag is set", async () => {
    const storage = memoryStorage({ [STORE_REVIEW_FLAG]: "1" });
    let fetched = false;
    let called = false;
    await maybeRequestReviewAfterFirstCatchSave({
      viewerId: "sam",
      storage,
      nativeIos: true,
      fetchImpl: async () => {
        fetched = true;
        return Response.json({ catches: [{ anglerId: "sam" }] });
      },
      requestReview: async () => {
        called = true;
      },
    });
    expect(fetched).toBe(false);
    expect(called).toBe(false);
  });

  it("uses the server list after a create and skips when more than one catch is stored", async () => {
    const storage = memoryStorage();
    const calls: string[] = [];
    await maybeRequestReviewAfterFirstCatchSave({
      viewerId: "sam",
      storage,
      nativeIos: true,
      fetchImpl: async () => Response.json({ catches: [{ anglerId: "sam" }] }),
      requestReview: async () => {
        calls.push("review");
      },
    });
    expect(calls).toEqual(["review"]);
    expect(storage.getItem(STORE_REVIEW_FLAG)).toBe("1");

    const later = memoryStorage();
    let called = false;
    await maybeRequestReviewAfterFirstCatchSave({
      viewerId: "sam",
      storage: later,
      nativeIos: true,
      fetchImpl: async () => Response.json({ catches: [{ anglerId: "sam" }, { anglerId: "sam" }] }),
      requestReview: async () => {
        called = true;
      },
    });
    expect(called).toBe(false);
    expect(later.getItem(STORE_REVIEW_FLAG)).toBe("1");
  });

  it("adds the offline catch that is not on the server yet", async () => {
    const storage = memoryStorage();
    let called = false;
    await maybeRequestReviewAfterFirstCatchSave({
      viewerId: "sam",
      savedLocallyOnly: true,
      storage,
      nativeIos: true,
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
      readLocalCatchCount: async () => 1,
      requestReview: async () => {
        called = true;
      },
    });
    expect(called).toBe(true);
    expect(storage.getItem(STORE_REVIEW_FLAG)).toBe("1");
  });

  it("leaves the flag unset when the catch count is still unknown", async () => {
    const storage = memoryStorage();
    await maybeRequestReviewAfterFirstCatchSave({
      viewerId: "sam",
      storage,
      nativeIos: true,
      fetchImpl: async () => new Response("nope", { status: 500 }),
      requestReview: async () => {
        throw new Error("should not run");
      },
    });
    expect(storage.snapshot()).toEqual({});
  });

  it("wires the prompt to a successful create and leaves Plan purchase code alone", () => {
    const form = readFileSync(resolve(__dirname, "../components/CatchForm.tsx"), "utf8");
    const sync = readFileSync(resolve(__dirname, "./offline-sync.ts"), "utf8");
    const iap = readFileSync(resolve(__dirname, "./native-iap.ts"), "utf8");
    const paywall = readFileSync(resolve(__dirname, "../components/Paywall.tsx"), "utf8");
    expect(form).toContain("rememberFirstCatch(true)");
    expect(form).toContain('if (mode === "create") rememberFirstCatch(false)');
    expect(form).not.toContain("alert(");
    expect(sync).toContain("maybeRequestReviewAfterFirstCatchSave");
    expect(iap).not.toContain("requestReview");
    expect(paywall).not.toContain("requestReview");
  });
});
