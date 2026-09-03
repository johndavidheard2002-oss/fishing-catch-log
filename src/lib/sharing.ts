import { groupBaitSpots } from "./bait";
import { fishCountLabel } from "./count";
import { groupSpots } from "./filters";
import { personalPhotoSrc } from "./photo";
import { speciesLabel } from "./species";
import type { BaitSpot, CatchRecord } from "./types";

/** A catch is visible to the viewer only if they own it, or it was shared with a linked buddy. */
export function isCatchVisibleToViewer(args: {
  anglerId: string;
  sharedWithLinked: boolean;
  viewerId: string;
  includeShared: boolean;
  linkedBuddyIds: string[];
}): boolean {
  if (args.anglerId === args.viewerId) return true;
  return (
    args.includeShared &&
    args.sharedWithLinked &&
    args.linkedBuddyIds.includes(args.anglerId)
  );
}

export type DayShareSpot = {
  key: string;
  kind: "catch" | "bait";
  placeName: string;
  summary: string;
  thumbSrc: string | null;
  catchIds: string[];
  baitSpotIds: string[];
  shared: boolean;
};

const COORD_NAME = /^-?\d+\.\d+(,\s*-?\d+\.\d+)?$/;

export function sharePlaceName(args: {
  placeName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): string {
  const raw = (args.placeName ?? "").trim().replace(/^bait:/, "");
  const label = raw.split(" · ")[0]?.trim() ?? "";
  if (label && !COORD_NAME.test(label)) return label;
  if (args.latitude != null && args.longitude != null) return "Pinned spot";
  return "Unnamed spot";
}

function firstPersonalThumb(paths: Array<string | null | undefined>): string | null {
  for (const path of paths) {
    const src = personalPhotoSrc(path ?? null);
    if (src) return src;
  }
  return null;
}

/** Viewer-owned catch and bait spots for one day, grouped like the map pins. */
export function dayShareSpots(args: {
  catches: CatchRecord[];
  baitSpots: BaitSpot[];
  viewerId: string;
}): DayShareSpot[] {
  const mineCatches = args.catches.filter((record) => record.anglerId === args.viewerId);
  const mineBait = args.baitSpots.filter((spot) => spot.anglerId === args.viewerId);
  const catchRows: DayShareSpot[] = groupSpots(mineCatches).map((group) => ({
    key: `catch:${group.key}`,
    kind: "catch",
    placeName: sharePlaceName({
      placeName: group.placeName,
      latitude: group.latitude,
      longitude: group.longitude,
    }),
    summary: `${speciesLabel(group.species)} · ${fishCountLabel(group.fishCount)}`,
    thumbSrc: firstPersonalThumb(group.catches.map((c) => c.photoPath)),
    catchIds: group.catches.map((c) => c.id),
    baitSpotIds: [],
    shared: group.catches.every((c) => c.sharedWithLinked),
  }));
  const baitRows: DayShareSpot[] = groupBaitSpots(mineBait).map((group) => {
    const baitLabel = group.baitTypes.length ? group.baitTypes.join(", ") : "Bait";
    return {
      key: `bait:${group.key}`,
      kind: "bait" as const,
      placeName: sharePlaceName({
        placeName: group.placeName,
        latitude: group.latitude,
        longitude: group.longitude,
      }),
      summary: group.visitCount > 1 ? `${baitLabel} · ${group.visitCount} logs` : baitLabel,
      thumbSrc: firstPersonalThumb(group.spots.map((s) => s.photoPath)),
      catchIds: [],
      baitSpotIds: group.spots.map((s) => s.id),
      shared: group.spots.every((s) => s.sharedWithLinked),
    };
  });
  return [...catchRows, ...baitRows];
}
