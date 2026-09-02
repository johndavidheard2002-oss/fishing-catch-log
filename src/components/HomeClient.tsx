"use client";

import Link from "next/link";
import { BrandWordmark } from "@/components/BrandWordmark";
import { BuddyPanel } from "@/components/BuddyPanel";
import { FirstHelpTip } from "@/components/HelpGuide";
import { SampleJournalControls } from "@/components/SampleJournalControls";

export function HomeClient() {
  return (
    <div className="space-y-6">
      <section className="page-intro home-lockup mx-auto w-fit text-center">
        <BrandWordmark as="h1" size="home" />
      </section>

      <FirstHelpTip />

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/log"
          className="flex items-center justify-center rounded-2xl bg-copper px-4 py-4 text-center text-lg font-semibold text-white"
        >
          Log a catch
        </Link>
        <Link
          href="/bait/new"
          className="flex items-center justify-center rounded-2xl bg-teal px-4 py-4 text-center text-lg font-semibold text-white"
          data-testid="home-log-bait"
        >
          Log bait
        </Link>
      </div>
      <Link
        href="/plan"
        className="home-plan-cta flex items-center justify-center rounded-2xl px-4 py-3 text-lg font-semibold"
      >
        Plan a day
      </Link>
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/calendar"
          className="flex items-center justify-center rounded-2xl border border-line bg-card px-4 py-3 font-semibold"
        >
          Calendar Log
        </Link>
        <Link
          href="/spots"
          className="flex flex-col items-center justify-center rounded-2xl border border-line bg-card px-4 py-3 font-semibold"
        >
          Spots
          <span className="text-xs font-normal text-ink-muted">Catch and bait</span>
        </Link>
      </div>

      <details className="app-more journal-card rounded-2xl">
        <summary className="cursor-pointer px-4 py-3">
          <span>
            <span className="block font-semibold">More</span>
            <span className="mt-0.5 block text-sm font-normal text-ink-muted">
              Link a buddy, sample catches, invite code
            </span>
          </span>
        </summary>
        <div className="space-y-3 px-4 pt-1">
          <SampleJournalControls />
        </div>
        <BuddyPanel embedded />
      </details>
    </div>
  );
}
