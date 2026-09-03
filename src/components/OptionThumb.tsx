const DEFAULT_THUMB_SIZE = 40;

export function OptionThumb({
  src,
  kind,
  size = DEFAULT_THUMB_SIZE,
}: {
  src: string | null;
  kind: "catch" | "bait";
  size?: number;
}) {
  const box = {
    ["--thumb-size" as string]: `${size}px`,
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    maxWidth: size,
    maxHeight: size,
    flexBasis: size,
    flexGrow: 0,
    flexShrink: 0,
  } as const;

  return (
    <div
      className="spot-option-thumb relative shrink-0 overflow-hidden rounded-xl bg-paper-deep"
      style={box}
      data-testid="spot-option-thumb"
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          className="spot-option-thumb-img absolute inset-0 block object-cover"
          style={{
            width: size,
            height: size,
            maxWidth: size,
            maxHeight: size,
            objectFit: "cover",
          }}
        />
      ) : kind === "bait" ? (
        <BaitMark />
      ) : (
        <FishMark />
      )}
    </div>
  );
}

function FishMark() {
  return (
    <svg viewBox="0 0 32 32" className="spot-option-thumb-img absolute inset-0 h-full w-full p-1.5 text-teal" fill="currentColor">
      <path d="M4 16c5-7 12-9 19-7 2 .6 4 1.8 5.5 3.2L26 16l2.5 3.8C27 21.2 25 22.4 23 23c-7 2-14 0-19-7Zm16.2-2.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z" />
    </svg>
  );
}

function BaitMark() {
  return (
    <svg viewBox="0 0 32 32" className="spot-option-thumb-img absolute inset-0 h-full w-full p-1.5 text-copper" fill="currentColor">
      <path d="M7 18c3-8 10-12 17-10 1.4.4 2.6 1.2 3.6 2.2-.8 3.4-3.2 6.4-6.6 8.2-4.4 2.4-9.4 2.2-14 .2Zm13.4-6.6a1.5 1.5 0 1 0 .2 3 1.5 1.5 0 0 0-.2-3ZM6 22.5c2.2 1.6 5 2.5 8 2.5 1.4 0 2.7-.2 4-.6-.8 1.4-2.4 2.6-4.6 2.6-3.2 0-5.8-1.8-7.4-4.5Z" />
    </svg>
  );
}
