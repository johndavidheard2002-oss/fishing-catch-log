import { Capacitor, registerPlugin } from "@capacitor/core";

/** One flag per device. "1" means we already asked or this angler is past their first catch. */
export const STORE_REVIEW_FLAG = "tidemark-store-review-asked";
const ASKED = "1";
const PENDING = "pending";

export type ReviewStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type CatchOwnerRow = { anglerId?: string | null };

type ReviewPlugin = { requestReview?: () => Promise<unknown> };

export function countOwnCatches(catches: CatchOwnerRow[] | null | undefined, viewerId: string): number | null {
  if (!Array.isArray(catches)) return null;
  if (!viewerId) return catches.length;
  return catches.filter((row) => row.anglerId === viewerId).length;
}

function browserStorage(): ReviewStorage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function readFlag(storage: ReviewStorage | null): string | null {
  try {
    return storage?.getItem(STORE_REVIEW_FLAG) ?? null;
  } catch {
    return null;
  }
}

function writeFlag(storage: ReviewStorage | null, value: string) {
  try {
    storage?.setItem(STORE_REVIEW_FLAG, value);
  } catch {
    // Private mode and quota errors stay quiet. The save itself already succeeded.
  }
}

export function runningInNativeIos(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
}

/**
 * The native proxy always exposes requestReview as a function. Older binaries
 * reject the call. 1.0 has no TideMarkStore header, so this returns null.
 */
export function nativeRequestReview(): (() => Promise<unknown>) | null {
  try {
    if (!runningInNativeIos()) return null;
    const cap = Capacitor as typeof Capacitor & { Plugins?: { TideMarkStore?: ReviewPlugin } };
    let plugin = cap.Plugins?.TideMarkStore;
    if (!plugin && typeof cap.isPluginAvailable === "function" && cap.isPluginAvailable("TideMarkStore")) {
      plugin = registerPlugin<ReviewPlugin>("TideMarkStore");
    }
    if (!plugin) return null;
    if (typeof cap.isPluginAvailable === "function" && cap.isPluginAvailable("TideMarkStore") !== true) {
      return null;
    }
    const requestReview = plugin.requestReview;
    if (typeof requestReview !== "function") return null;
    return () => requestReview();
  } catch {
    return null;
  }
}

async function fetchOwnCatchCount(viewerId: string, fetchImpl: typeof fetch): Promise<number | null> {
  try {
    const res = await fetchImpl("/api/catches", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { catches?: CatchOwnerRow[] };
    // GET /api/catches is already limited to this angler's own rows.
    if (!Array.isArray(data.catches)) return null;
    if (!viewerId) return data.catches.length;
    const own = countOwnCatches(data.catches, viewerId);
    if (own == null) return null;
    if (own === 0 && data.catches.length > 0) return data.catches.length;
    return own;
  } catch {
    return null;
  }
}

async function localOwnCatchCountIncludingNew(viewerId: string): Promise<number | null> {
  try {
    const { readJournalCache } = await import("./offline-store");
    const cache = await readJournalCache();
    if (!cache) return null;
    const saved = countOwnCatches(cache.catches, viewerId);
    if (saved == null) return null;
    // A placeholder viewer id must not treat someone else's cached rows as zero.
    if (viewerId && saved === 0 && cache.catches.length > 0) return null;
    return saved + 1;
  } catch {
    return null;
  }
}

let reviewInFlight = false;

export function resetStoreReviewForTests() {
  reviewInFlight = false;
}

/**
 * After a successful create, ask iOS for the system rating sheet once per device.
 * Edits, the website, the 1.0 binary, and builds without requestReview do nothing.
 * A missing method is remembered as pending so the first catch can still ask
 * after the binary that implements it is installed.
 */
export async function maybeRequestReviewAfterFirstCatchSave(args: {
  viewerId?: string | null;
  /** Offline queue: the new catch is not on the server yet. */
  savedLocallyOnly?: boolean;
  ownCatchCount?: number | null;
  storage?: ReviewStorage | null;
  nativeIos?: boolean;
  requestReview?: (() => Promise<unknown>) | null;
  fetchImpl?: typeof fetch;
  readLocalCatchCount?: (viewerId: string) => Promise<number | null>;
} = {}): Promise<void> {
  try {
    const native = args.nativeIos ?? runningInNativeIos();
    if (!native) return;
    if (reviewInFlight) return;
    reviewInFlight = true;
    try {
      const storage = args.storage === undefined ? browserStorage() : args.storage;
      const flag = readFlag(storage);
      if (flag === ASKED) return;

      const viewerId = args.viewerId ?? "";
      let count = args.ownCatchCount === undefined ? null : args.ownCatchCount;
      if (count == null && flag !== PENDING) {
        const server = await fetchOwnCatchCount(viewerId, args.fetchImpl ?? fetch);
        if (server != null) count = args.savedLocallyOnly ? server + 1 : server;
        if (count == null && args.savedLocallyOnly) {
          const readLocal = args.readLocalCatchCount ?? localOwnCatchCountIncludingNew;
          count = await readLocal(viewerId);
        }
      }

      const requestReview =
        args.requestReview === undefined ? nativeRequestReview() : args.requestReview;
      const firstCatch = count === 1;
      const waiting = flag === PENDING;

      if (!firstCatch && !waiting) {
        if (count != null && count > 1) writeFlag(storage, ASKED);
        return;
      }
      if (typeof requestReview !== "function") {
        if (firstCatch) writeFlag(storage, PENDING);
        return;
      }
      try {
        await requestReview();
        writeFlag(storage, ASKED);
      } catch {
        if (firstCatch || waiting) writeFlag(storage, PENDING);
      }
    } finally {
      reviewInFlight = false;
    }
  } catch {
    reviewInFlight = false;
  }
}
