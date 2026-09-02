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
