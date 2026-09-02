"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BuddyPanel } from "@/components/BuddyPanel";
import { spotKey } from "@/lib/filters";
import type { CatchRecord } from "@/lib/types";

export function HomeClient() {
  const [catches, setCatches] = useState<CatchRecord[]>([]);

  useEffect(() => {
    fetch("/api/catches")
      .then(async (r) => {
        if (!r.ok) throw new Error("bad status");
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data.catches)) setCatches(data.catches);
      })
      .catch(() => {});
  }, []);

  const species = new Set(
    catches.flatMap((c) => (c.speciesList?.length ? c.speciesList : [c.species])),
  ).size;
  const spots = new Set(catches.map(spotKey)).size;

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm tracking-wide text-ink-muted uppercase">Automatic Logbook</p>
        <h1 className="font-display mt-1 text-4xl leading-tight text-teal">
          Remember the trip. Find the pattern later.
        </h1>
        <p className="mt-2 text-ink-muted">
          Photo, species, weather, and spot — then search the days that felt like this one.
        </p>
      </section>

      <Link
        href="/log"
        className="flex items-center justify-center rounded-2xl bg-copper px-4 py-4 text-lg font-semibold text-white"
      >
        Log a catch
      </Link>
      <Link
        href="/backfill"
        className="flex items-center justify-center rounded-2xl border border-line bg-card px-4 py-3 font-semibold"
      >
        Backfill a past catch
      </Link>
      <Link
        href="/plan"
        className="flex items-center justify-center rounded-2xl border border-line bg-card px-4 py-3 font-semibold text-teal"
      >
        Plan the next few days
      </Link>
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/history?view=calendar"
          className="flex items-center justify-center rounded-2xl border border-line bg-card px-4 py-3 font-semibold"
        >
          Calendar
        </Link>
        <Link
          href="/spots"
          className="flex items-center justify-center rounded-2xl border border-line bg-card px-4 py-3 font-semibold"
        >
          Spots
        </Link>
      </div>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink-muted">Your journal</h2>
          <Link href="/history" className="text-sm font-semibold text-teal">
            Open History
          </Link>
        </div>
        <dl className="grid grid-cols-3 gap-2">
          <Stat label="Catches" value={catches.length} />
          <Stat label="Species" value={species} />
          <Stat label="Spots" value={spots} />
        </dl>
      </section>

      <details className="app-more journal-card rounded-2xl">
        <summary className="cursor-pointer px-4 py-3">
          <span>
            <span className="block font-semibold">More</span>
            <span className="mt-0.5 block text-sm font-normal text-ink-muted">
              Link a buddy, your name, invite code
            </span>
          </span>
        </summary>
        <BuddyPanel embedded />
      </details>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="journal-card rounded-2xl px-3 py-3 text-center">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="font-display text-2xl text-teal">{value}</dd>
    </div>
  );
}
