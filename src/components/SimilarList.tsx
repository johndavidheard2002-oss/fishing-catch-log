import Link from "next/link";
import { CatchCard } from "./CatchCard";
import { weatherLine } from "@/lib/photo";
import { formatDateOnly } from "@/lib/time";
import { VERY_STRONG_MATCH_LABEL } from "@/lib/similar";
import type { SimilarMatch } from "@/lib/types";

export function SimilarList({ matches }: { matches: SimilarMatch[] }) {
  if (!matches.length) {
    return (
      <p className="on-wash-chip text-sm">
        No close matches yet. Log more trips and this gets sharper.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {matches.map((match) => (
        <li key={match.catch.id} className="space-y-1.5">
          <CatchCard record={match.catch} compact />
          {match.strength === "very-strong" ? (
            <p className="on-wash-chip w-fit px-1 text-[11px] font-semibold text-teal">{VERY_STRONG_MATCH_LABEL}</p>
          ) : null}
          <p className="on-wash-chip px-1 text-xs">
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
