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

  if (!src && kind === "bait") return null;

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

