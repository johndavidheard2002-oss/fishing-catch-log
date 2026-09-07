"use client";

import { useEffect, useState } from "react";
import { ownerShareBadgeLabel, type ShareFriendName } from "@/lib/sharing";

let cachedFriends: ShareFriendName[] | null = null;
let inflight: Promise<ShareFriendName[]> | null = null;

function loadShareFriends(): Promise<ShareFriendName[]> {
  if (cachedFriends) return Promise.resolve(cachedFriends);
  if (!inflight) {
    inflight = fetch("/api/buddies")
      .then((r) => r.json())
      .then((data) => {
        const friends = ((data.buddies ?? []) as { id?: string; name?: string }[])
          .filter((buddy): buddy is ShareFriendName => Boolean(buddy.id && buddy.name?.trim()))
          .map((buddy) => ({ id: buddy.id, name: buddy.name.trim() }));
        cachedFriends = friends;
        return friends;
      })
      .catch(() => [] as ShareFriendName[])
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Owner’s own List photo: Private, or Shared plus friend names. */
export function OwnerShareBadge({
  sharedWithLinked,
  sharedWithBuddyIds,
  compact = false,
  friends,
}: {
  sharedWithLinked?: boolean;
  sharedWithBuddyIds?: string[] | null;
  compact?: boolean;
  friends?: ShareFriendName[];
}) {
  const [loaded, setLoaded] = useState<ShareFriendName[]>(friends ?? []);

  useEffect(() => {
    if (friends) {
      setLoaded(friends);
      return;
    }
    void loadShareFriends().then(setLoaded);
  }, [friends]);

  const label = ownerShareBadgeLabel({
    sharedWithLinked,
    sharedWithBuddyIds,
    friends: friends ?? loaded,
  });
  const shared = label !== "Private";

  return (
    <span
      aria-label={label}
      title={label}
      data-testid="owner-share-badge"
      data-shared={shared ? "true" : "false"}
      className={
        compact
          ? `pointer-events-none absolute right-0.5 top-0.5 z-[5] max-w-[calc(100%-0.25rem)] truncate rounded-full px-1 py-px text-[8px] font-bold leading-tight text-white shadow ${
              shared ? "bg-teal/90" : "bg-ink/70"
            }`
          : `pointer-events-none absolute right-1 top-1 z-[5] max-w-[calc(100%-0.5rem)] truncate rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white shadow ${
              shared ? "bg-teal/90" : "bg-ink/70"
            }`
      }
    >
      {label}
    </span>
  );
}
