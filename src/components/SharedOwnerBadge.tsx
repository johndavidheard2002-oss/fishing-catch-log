/** High-contrast name pill on a shared friend’s photo. Own catches stay unmarked. */
export function SharedOwnerBadge({
  name,
  compact = false,
}: {
  name: string;
  compact?: boolean;
}) {
  const label = name.trim();
  if (!label) return null;
  return (
    <span
      aria-label={`Shared by ${label}`}
      title={label}
      data-testid="shared-owner-badge"
      className={
        compact
          ? "pointer-events-none absolute bottom-0.5 left-0.5 z-[5] max-w-[calc(100%-0.25rem)] truncate rounded-full bg-copper px-1 py-px text-[8px] font-bold leading-tight text-white shadow"
          : "pointer-events-none absolute bottom-1 left-1 z-[5] max-w-[calc(100%-0.5rem)] truncate rounded-full bg-copper px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white shadow"
      }
    >
      {label}
    </span>
  );
}
