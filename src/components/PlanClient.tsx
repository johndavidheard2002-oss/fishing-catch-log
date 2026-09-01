"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { photoSrc } from "@/lib/photo";
import { formatDateOnly, formatWeekdayDate, TIME_OF_DAY_LABELS } from "@/lib/time";
import { conditionLabel } from "@/lib/similar";
import type { PlanResult, PlanSuggestion } from "@/lib/types";

export function PlanClient() {
  const [days, setDays] = useState<3 | 5 | 7>(5);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/plan?days=${days}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setPlan(data);
          setError(null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not build a plan.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const byDay = useMemo(() => {
    const map = new Map<string, PlanSuggestion[]>();
    for (const s of plan?.suggestions ?? []) {
      const list = map.get(s.window.date) ?? [];
      list.push(s);
      map.set(s.window.date, list);
    }
    return [...map.entries()];
  }, [plan]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-teal">Plan</h1>
        <p className="text-sm text-ink-muted">
          Upcoming windows matched to days you actually caught fish — not a guarantee, a pattern
          match.
        </p>
      </div>

      <div className="flex gap-2">
        {([3, 5, 7] as const).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => {
              if (n !== days) setLoading(true);
              setDays(n);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              days === n ? "bg-teal text-white" : "border border-line bg-card"
            }`}
          >
            Next {n} days
          </button>
        ))}
      </div>

      {plan ? (
        <p className="rounded-2xl border border-line bg-card px-3 py-2 text-xs text-ink-muted">
          {plan.weatherSource === "demo" || plan.tideSource === "demo"
            ? "Demo forecast/tides until you add API keys. "
            : "Live forecast"}
          {plan.weatherSource === "openweather" ? " Weather: OpenWeather. " : null}
          {plan.tideSource === "worldtides" ? " Tides: WorldTides. " : null}
          Suggestions compare sky, temp, wind, time of day, season, and tide (where you logged it)
          against productive trips.
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-ink-muted">Matching upcoming days to your journal…</p>
      ) : error ? (
        <p className="text-sm text-copper">{error}</p>
      ) : !plan?.suggestions.length ? (
        <p className="text-sm text-ink-muted">
          No close matches in this window. Log more catches, or try a longer range.
        </p>
      ) : (
        byDay.map(([date, items]) => (
          <section key={date} className="space-y-2">
            <h2 className="font-display text-xl text-teal">{formatWeekdayDate(date)}</h2>
            {items.map((s) => (
              <SuggestionCard key={s.id} suggestion={s} />
            ))}
          </section>
        ))
      )}
    </div>
  );
}

function SuggestionCard({ suggestion }: { suggestion: PlanSuggestion }) {
  const w = suggestion.window;
  const src = photoSrc(suggestion.matches[0]?.catch.photoPath ?? null);
  return (
    <article className="journal-card overflow-hidden rounded-2xl">
      <div className="flex gap-3 p-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-paper-deep">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold">{suggestion.placeName}</h3>
            <StrengthBadge strength={suggestion.strength} />
          </div>
          <p className="text-sm text-ink-muted">
            {TIME_OF_DAY_LABELS[w.timeOfDay]}
            {w.temperatureF != null ? ` · ${Math.round(w.temperatureF)}°F` : ""}
            {w.weatherCondition ? ` · ${conditionLabel(w.weatherCondition)}` : ""}
            {w.windSpeedMph != null ? ` · ${Math.round(w.windSpeedMph)} mph` : ""}
            {w.tide ? ` · ${w.tide} tide` : ""}
          </p>
        </div>
      </div>
      <p className="px-3 pb-2 text-sm">{suggestion.headline}</p>
      <p className="px-3 text-xs text-ink-muted">
        Why: {suggestion.reasons.slice(0, 5).join(" · ") || "pattern overlap"}
      </p>
      <ul className="space-y-1 px-3 py-3">
        {suggestion.matches.map((m) => (
          <li key={m.catch.id}>
            <Link
              href={`/catch/${m.catch.id}`}
              className="text-sm font-semibold text-teal"
            >
              {m.catch.species} · {formatDateOnly(m.catch.caughtAt)}
            </Link>
            <span className="text-xs text-ink-muted"> — {m.reasons.slice(0, 3).join(", ")}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function StrengthBadge({ strength }: { strength: PlanSuggestion["strength"] }) {
  const label = strength === "strong" ? "Strong match" : strength === "good" ? "Good match" : "Lean match";
  const cls =
    strength === "strong"
      ? "bg-good text-white"
      : strength === "good"
        ? "bg-teal text-white"
        : "bg-paper-deep text-ink";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>;
}
