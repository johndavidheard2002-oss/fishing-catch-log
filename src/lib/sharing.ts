import { groupBaitSpots } from "./bait";
import { localDateKey } from "./calendar";
import { fishCountLabel } from "./count";
import { groupSpots } from "./filters";
import { personalPhotoSrc } from "./photo";
import { PRIVACY_LINE } from "./privacy";
import { speciesLabel } from "./species";
import type { BaitSpot, CalendarNote, CatchRecord } from "./types";

export const OWNER_PRIVATE_STATUS_LINE = "Private to you. Not shared with anyone.";
export const OWNER_SHARED_PUBLIC_NOTE = "Never public. No feed.";

/** A catch is visible to the viewer only if they own it, or it was shared with them. */
export function isCatchVisibleToViewer(args: {
  anglerId: string;
  sharedWithLinked: boolean;
  viewerId: string;
  includeShared: boolean;
  linkedBuddyIds: string[];
  sharedWithBuddyIds?: string[];
  sharedWithViewer?: boolean;
}): boolean {
  if (args.anglerId === args.viewerId) return true;
  if (!args.includeShared) return false;
  if (!args.linkedBuddyIds.includes(args.anglerId)) return false;
  if (args.sharedWithLinked) return true;
  if (args.sharedWithViewer) return true;
  return Boolean(args.sharedWithBuddyIds?.includes(args.viewerId));
}

/** Broadcast-to-all when buddyIds is omitted; otherwise only those friends. */
export function resolveShareTargets(args: {
  shared: boolean;
  buddyIds?: string[] | null;
  linkedBuddyIds: string[];
}): { sharedWithLinked: boolean; buddyIds: string[] } {
  if (!args.shared) return { sharedWithLinked: false, buddyIds: [] };
  const picked = (args.buddyIds ?? []).filter((id) => args.linkedBuddyIds.includes(id));
  if (args.buddyIds == null) {
    return { sharedWithLinked: true, buddyIds: [] };
  }
  return { sharedWithLinked: false, buddyIds: picked };
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
    shared: group.catches.every((c) => c.sharedWithLinked || (c.sharedWithBuddyIds?.length ?? 0) > 0),
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
      shared: group.spots.every((s) => s.sharedWithLinked || (s.sharedWithBuddyIds?.length ?? 0) > 0),
    };
  });
  return [...catchRows, ...baitRows];
}

/** True when the owner has shared this catch or bait spot with anyone. */
export function isOwnerSharedSpot(record: {
  sharedWithLinked?: boolean;
  sharedWithBuddyIds?: string[] | null;
}): boolean {
  return Boolean(record.sharedWithLinked || (record.sharedWithBuddyIds?.length ?? 0) > 0);
}

export type ShareFriendName = { id: string; name: string };

/** Linked friends this owner shared the spot with, in friend-list order. */
export function ownerShareFriendNames(args: {
  sharedWithLinked?: boolean;
  sharedWithBuddyIds?: string[] | null;
  friends: ShareFriendName[];
}): string[] {
  if (!isOwnerSharedSpot(args)) return [];
  if (args.sharedWithLinked) {
    return args.friends.map((friend) => friend.name.trim()).filter(Boolean);
  }
  const picked = new Set(args.sharedWithBuddyIds ?? []);
  return args.friends
    .filter((friend) => picked.has(friend.id))
    .map((friend) => friend.name.trim())
    .filter(Boolean);
}

/** Calendar List row badge: Private, Shared, or Shared · Tyler, Mo. */
export function ownerShareBadgeLabel(args: {
  sharedWithLinked?: boolean;
  sharedWithBuddyIds?: string[] | null;
  friends: ShareFriendName[];
}): string {
  if (!isOwnerSharedSpot(args)) return "Private";
  const names = ownerShareFriendNames(args);
  if (!names.length) return "Shared";
  return `Shared · ${names.join(", ")}`;
}

function joinFriendNames(names: string[]): string {
  if (names.length === 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/** Catch/bait detail prose: Private, Shared with Mo, or Shared with all linked. */
export function ownerShareStatusLine(args: {
  sharedWithLinked?: boolean;
  sharedWithBuddyIds?: string[] | null;
  friends: ShareFriendName[];
}): string {
  if (!isOwnerSharedSpot(args)) return OWNER_PRIVATE_STATUS_LINE;
  const names = ownerShareFriendNames(args);
  if (names.length) return `Shared with ${joinFriendNames(names)}. ${OWNER_SHARED_PUBLIC_NOTE}`;
  if (args.sharedWithLinked) return `${PRIVACY_LINE} ${OWNER_SHARED_PUBLIC_NOTE}`;
  return `Shared. ${OWNER_SHARED_PUBLIC_NOTE}`;
}

/** Place name already on the record — empty when missing, never a placeholder. */
export function recordedSharePlaceName(placeName?: string | null): string | null {
  const label = (placeName ?? "").trim().replace(/^bait:/, "").trim();
  return label || null;
}

/** spot_shares.record_id for a plan day — owner-scoped so two anglers can share the same date. */
export function planShareRecordId(ownerId: string, day: string): string {
  return `${ownerId}:${day}`;
}

/** Share flags for the Planned card — one day, one set of friends. */
export function planDayShareState(
  notes: Array<{
    sharedWithLinked?: boolean;
    sharedWithBuddyIds?: string[] | null;
  }>,
): { sharedWithLinked: boolean; sharedWithBuddyIds: string[] } {
  const buddyIds = new Set<string>();
  let sharedWithLinked = false;
  for (const note of notes) {
    if (note.sharedWithLinked) sharedWithLinked = true;
    for (const id of note.sharedWithBuddyIds ?? []) {
      if (id) buddyIds.add(id);
    }
  }
  return { sharedWithLinked, sharedWithBuddyIds: [...buddyIds] };
}

export type OwnerSharedDay = {
  day: string;
  placeNames: string[];
};

type SharedDayAcc = { day: string; names: string[]; seen: Set<string> };

function addSharedDayPlace(byDay: Map<string, SharedDayAcc>, day: string, placeName: string | null) {
  let row = byDay.get(day);
  if (!row) {
    row = { day, names: [], seen: new Set() };
    byDay.set(day, row);
  }
  if (!placeName) return;
  const key = placeName.toLowerCase().replace(/\s+/g, " ");
  if (row.seen.has(key)) return;
  row.seen.add(key);
  row.names.push(placeName);
}

/** Home “Days you shared” rows: calendar day plus the spots shared that day. */
export function ownerSharedDays(args: {
  catches: Array<
    Pick<CatchRecord, "caughtAt" | "placeName" | "sharedWithLinked"> &
      Partial<Pick<CatchRecord, "anglerId" | "sharedWithBuddyIds">>
  >;
  baitSpots: Array<
    Pick<BaitSpot, "loggedAt" | "placeName" | "sharedWithLinked"> &
      Partial<Pick<BaitSpot, "anglerId" | "sharedWithBuddyIds">>
  >;
  notes?: Array<
    Pick<CalendarNote, "day" | "placeName" | "sharedWithLinked"> &
      Partial<Pick<CalendarNote, "anglerId" | "sharedWithBuddyIds" | "title">>
  >;
  ownerId?: string;
}): OwnerSharedDay[] {
  const byDay = new Map<string, SharedDayAcc>();

  for (const record of args.catches) {
    if (args.ownerId && record.anglerId && record.anglerId !== args.ownerId) continue;
    if (!isOwnerSharedSpot(record)) continue;
    if (typeof record.caughtAt !== "string" || !record.caughtAt) continue;
    addSharedDayPlace(byDay, localDateKey(record.caughtAt), recordedSharePlaceName(record.placeName));
  }
  for (const spot of args.baitSpots) {
    if (args.ownerId && spot.anglerId && spot.anglerId !== args.ownerId) continue;
    if (!isOwnerSharedSpot(spot)) continue;
    if (typeof spot.loggedAt !== "string" || !spot.loggedAt) continue;
    addSharedDayPlace(byDay, localDateKey(spot.loggedAt), recordedSharePlaceName(spot.placeName));
  }
  for (const note of args.notes ?? []) {
    if (args.ownerId && note.anglerId && note.anglerId !== args.ownerId) continue;
    if (!isOwnerSharedSpot(note)) continue;
    if (typeof note.day !== "string" || !note.day) continue;
    addSharedDayPlace(
      byDay,
      note.day,
      recordedSharePlaceName(note.placeName) ?? recordedSharePlaceName(note.title),
    );
  }

  return [...byDay.values()]
    .sort((a, b) => b.day.localeCompare(a.day))
    .map(({ day, names }) => ({ day, placeNames: names }));
}
