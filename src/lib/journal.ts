import type { BaitSpot, CatchRecord } from "./types";

export type JournalFeedItem =
  | { kind: "catch"; id: string; at: string; record: CatchRecord }
  | { kind: "bait"; id: string; at: string; spot: BaitSpot };

/** Newest first — same journal as Calendar Log, catches and bait together. */
export function mergeJournalFeed(
  catches: CatchRecord[],
  baitSpots: BaitSpot[],
): JournalFeedItem[] {
  const items: JournalFeedItem[] = [
    ...catches.map((record) => ({
      kind: "catch" as const,
      id: `catch:${record.id}`,
      at: record.caughtAt,
      record,
    })),
    ...baitSpots.map((spot) => ({
      kind: "bait" as const,
      id: `bait:${spot.id}`,
      at: spot.loggedAt,
      spot,
    })),
  ];
  return items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
