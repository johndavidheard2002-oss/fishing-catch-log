"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandWordmark } from "@/components/BrandWordmark";
import { BuddyPanel } from "@/components/BuddyPanel";
import { FirstHelpTip } from "@/components/HelpGuide";
import { LogOutButton } from "@/components/LogOutButton";

type MeState = {
  signedIn: boolean;
  name: string;
  email: string;
  ready: boolean;
};

export function HomeClient() {
  const router = useRouter();
  const [me, setMe] = useState<MeState>({ signedIn: false, name: "", email: "", ready: false });

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.signedIn) {
          router.replace("/signin");
          return;
        }
        setMe({
          signedIn: true,
          name: data.me?.name ?? "",
          email: typeof data.me?.email === "string" ? data.me.email : "",
          ready: true,
        });
      })
      .catch(() => router.replace("/signin"));
  }, [router]);

  return (
    <div className="space-y-6">
      <section className="page-intro home-lockup mx-auto w-fit text-center" data-testid="home-lockup">
        <BrandWordmark as="h1" size="home" />
      </section>

      <FirstHelpTip />

      {me.ready ? (
        <section className="journal-card space-y-2 rounded-2xl p-4" data-testid="home-account">
          <p className="text-sm">
            <span className="font-semibold">{me.name || "Signed in"}</span>
            {me.email ? <span className="mt-0.5 block text-xs text-ink-muted">{me.email}</span> : null}
          </p>
          <LogOutButton />
        </section>
      ) : null}

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
              Account, friends, and invite codes
            </span>
          </span>
        </summary>
        <div className="space-y-3 px-4 pb-2">
          <p className="text-sm font-semibold">Account</p>
          <LogOutButton testId="log-out-more" />
        </div>
        <BuddyPanel embedded />
      </details>
    </div>
  );
}
