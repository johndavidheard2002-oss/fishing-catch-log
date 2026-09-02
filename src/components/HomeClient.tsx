"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BuddyPanel } from "@/components/BuddyPanel";
import { CatchGridCard } from "@/components/CatchCard";
import { formatDateOnly } from "@/lib/time";
import { weatherLine } from "@/lib/photo";
import type { CatchRecord } from "@/lib/types";

export function HomeClient() {
  const [catches, setCatches] = useState<CatchRecord[]>([]);

  useEffect(() => {
    fetch("/api/catches")
      .then((r) => r.json())
      .then((data) => setCatches(data.catches ?? []));
  }, []);

  const latest = catches[0];
  const species = new Set(catches.map((c) => c.species)).size;
  const spots = new Set(catches.map((c) => c.placeName || "unknown")).size;

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm tracking-wide text-ink-muted uppercase">Logbook</p>
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
        href="/log?past=1"
        className="flex items-center justify-center rounded-2xl border border-line bg-card px-4 py-3 font-semibold"
      >
        Add a past catch
      </Link>
      <Link
        href="/plan"
        className="flex items-center justify-center rounded-2xl border border-line bg-card px-4 py-3 font-semibold text-teal"
      >
        Plan the next few days
      </Link>

      <dl className="grid grid-cols-3 gap-2">
        <Stat label="Catches" value={catches.length} />
        <Stat label="Species" value={species} />
        <Stat label="Spots" value={spots} />
      </dl>

      {latest ? (
        <section className="journal-card rounded-2xl p-4">
          <p className="text-xs tracking-wide text-ink-muted uppercase">Last trip</p>
          <p className="mt-1 text-lg font-semibold">{latest.species}</p>
          <p className="text-sm text-ink-muted">
            {latest.placeName || "Unnamed spot"} · {formatDateOnly(latest.caughtAt)}
          </p>
          <p className="text-sm text-ink-muted">{weatherLine(latest)}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <Link href={`/catch/${latest.id}#similar`} className="font-semibold text-teal">
              Find similar conditions →
            </Link>
            <Link href="/plan" className="font-semibold text-teal">
              Plan ahead →
            </Link>
          </div>
        </section>
      ) : null}

      <BuddyPanel />

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl text-teal">Recent</h2>
          <Link href="/history" className="text-sm font-semibold text-teal">
            All catches
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {catches.slice(0, 6).map((record) => (
            <CatchGridCard key={record.id} record={record} />
          ))}
        </div>
      </section>
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
