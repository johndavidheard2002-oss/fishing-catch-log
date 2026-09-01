import Link from "next/link";
import { CatchCard } from "./CatchCard";
import { weatherLine } from "@/lib/photo";
import { formatDateOnly } from "@/lib/time";
import type { SimilarMatch } from "@/lib/types";

export function SimilarList({ matches }: { matches: SimilarMatch[] }) {
  if (!matches.length) {
    return (
      <p className="text-sm text-ink-muted">
        No close matches yet. Log more trips and this gets sharper.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {matches.map((match) => (
        <li key={match.catch.id} className="space-y-1.5">
          <CatchCard record={match.catch} compact />
          <p className="px-1 text-xs text-ink-muted">
            Why: {match.reasons.slice(0, 4).join(" · ") || weatherLine(match.catch)} ·{" "}
            {formatDateOnly(match.catch.caughtAt)}
          </p>
          <p className="sr-only">
            Score {match.score}. <Link href={`/catch/${match.catch.id}`}>Open</Link>
          </p>
        </li>
      ))}
    </ul>
  );
}
