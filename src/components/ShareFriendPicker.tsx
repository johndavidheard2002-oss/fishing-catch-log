"use client";

export type ShareFriend = { id: string; name: string };

export function ShareFriendPicker({
  buddies,
  selectedIds,
  onChange,
  disabled = false,
}: {
  buddies: ShareFriend[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  if (!buddies.length) return null;
  return (
    <div className="mt-2 space-y-1.5" data-testid="share-friend-picker">
      <p className="text-xs text-ink-muted">
        Choose who sees this spot. Each friend only sees spots you pick for them.
      </p>
      {buddies.map((buddy) => {
        const on = selectedIds.includes(buddy.id);
        return (
          <label
            key={buddy.id}
            className={`flex items-center gap-3 rounded-xl bg-teal px-4 py-3 text-white ${
              disabled ? "opacity-50" : ""
            }`}
          >
            <input
              type="checkbox"
              data-testid={`share-friend-${buddy.id}`}
              checked={on}
              disabled={disabled}
              className="h-5 w-5 shrink-0 accent-white"
              onChange={(event) => {
                if (event.target.checked) onChange([...selectedIds, buddy.id]);
                else onChange(selectedIds.filter((id) => id !== buddy.id));
              }}
            />
            <span className="text-xl font-semibold leading-snug">{buddy.name}</span>
          </label>
        );
      })}
    </div>
  );
}

export function selectedShareBuddyIds(args: {
  sharedWithLinked: boolean;
  sharedWithBuddyIds?: string[];
  buddyIds: string[];
}): string[] {
  if (args.sharedWithLinked) return args.buddyIds;
  return args.sharedWithBuddyIds ?? [];
}
