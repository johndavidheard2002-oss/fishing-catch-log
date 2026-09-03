import { baitSpotLabel, catchSpotLabel } from "./calendar";
import { groupSpots } from "./filters";
import { baitTypesLabel } from "./bait";
import { catchSpeciesTitle } from "./count";
import type { BaitSpot, BaitSpotGroup, CatchRecord, SpotGroup } from "./types";

export type LocationMapTarget = {
  kind: "catch" | "bait";
  title: string;
  place: string;
  latitude: number | null;
  longitude: number | null;
  spots: SpotGroup[];
  baitSpots: BaitSpot[];
  href?: string;
  hrefLabel?: string;
};

export function hasSavedPin(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
) {
  return latitude != null && longitude != null;
}

export function targetFromCatch(record: CatchRecord): LocationMapTarget {
  const hasPin = hasSavedPin(record.latitude, record.longitude);
  return {
    kind: "catch",
    title: catchSpeciesTitle(record),
    place: catchSpotLabel(record),
    latitude: record.latitude,
    longitude: record.longitude,
    spots: hasPin ? groupSpots([record]) : [],
    baitSpots: [],
    href: `/catch/${record.id}`,
    hrefLabel: "Open catch",
  };
}

export function targetFromBait(spot: BaitSpot): LocationMapTarget {
  return {
    kind: "bait",
    title: baitTypesLabel(spot.baitTypes),
    place: baitSpotLabel(spot),
    latitude: spot.latitude,
    longitude: spot.longitude,
    spots: [],
    baitSpots: hasSavedPin(spot.latitude, spot.longitude) ? [spot] : [],
    href: `/bait/${spot.id}`,
    hrefLabel: "Open bait hole",
  };
}

export function targetFromSpotGroup(spot: SpotGroup): LocationMapTarget {
  const pinned = spot.catches.find((record) => hasSavedPin(record.latitude, record.longitude));
  return {
    kind: "catch",
    title: spot.placeName,
    place: spot.placeName,
    latitude: spot.latitude,
    longitude: spot.longitude,
    spots: hasSavedPin(spot.latitude, spot.longitude) ? [spot] : [],
    baitSpots: [],
    href: pinned ? `/catch/${pinned.id}` : undefined,
    hrefLabel: pinned ? "Open catch" : undefined,
  };
}

export function targetFromBaitGroup(group: BaitSpotGroup): LocationMapTarget {
  const pinned = group.spots.find((spot) => hasSavedPin(spot.latitude, spot.longitude));
  return {
    kind: "bait",
    title: group.placeName,
    place: group.placeName,
    latitude: group.latitude,
    longitude: group.longitude,
    spots: [],
    baitSpots: pinned ? [pinned] : [],
    href: pinned ? `/bait/${pinned.id}` : undefined,
    hrefLabel: pinned ? "Open bait hole" : undefined,
  };
}
