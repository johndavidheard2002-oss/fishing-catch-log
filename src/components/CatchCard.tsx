import Link from "next/link";
import { formatDateOnly } from "@/lib/time";
import { photoSrc, weatherLine } from "@/lib/photo";
import type { CatchRecord } from "@/lib/types";

export function CatchCard({
  record,
  compact = false,
}: {
  record: CatchRecord;
  compact?: boolean;
}) {
  const src = photoSrc(record.photoPath);
  return (
    <Link
      href={`/catch/${record.id}`}
      className="journal-card flex overflow-hidden rounded-2xl"
    >
      <div className={`${compact ? "h-20 w-20" : "h-24 w-24"} shrink-0 bg-paper-deep`}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-ink-muted">
            No photo
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 px-3 py-2">
        <p className="truncate font-semibold text-ink">{record.species}</p>
        <p className="truncate text-sm text-ink-muted">{record.placeName || "Unnamed spot"}</p>
        <p className="mt-1 truncate text-xs text-ink-muted">
          {formatDateOnly(record.caughtAt)} · {record.timeOfDay} · {weatherLine(record)}
        </p>
      </div>
    </Link>
  );
}

export function CatchGridCard({ record }: { record: CatchRecord }) {
  const src = photoSrc(record.photoPath);
  return (
    <Link href={`/catch/${record.id}`} className="journal-card overflow-hidden rounded-2xl">
      <div className="aspect-square bg-paper-deep">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-ink-muted">
            No photo
          </div>
        )}
      </div>
      <div className="px-2.5 py-2">
        <p className="truncate text-sm font-semibold">{record.species}</p>
        <p className="truncate text-xs text-ink-muted">{record.placeName || "Unnamed spot"}</p>
      </div>
    </Link>
  );
}
