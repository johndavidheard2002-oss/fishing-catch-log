"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BrandWordmark } from "@/components/BrandWordmark";
import { BuddyPanel } from "@/components/BuddyPanel";
import { FirstHelpTip } from "@/components/HelpGuide";
import { LogOutButton } from "@/components/LogOutButton";
import { Paywall } from "@/components/Paywall";
import { TrialNotice, TrialNoticeModal } from "@/components/TrialNotice";
import {
  TRIAL_OFFER_LINE,
  YEARLY_PRICE_LABEL,
  journalUnlocked,
  openPaywall,
  type EntitlementSnapshot,
} from "@/lib/entitlement";

type MeState = {
  signedIn: boolean;
  id: string;
  name: string;
  email: string;
  ready: boolean;
  entitlement: EntitlementSnapshot | null;
};

function LockedCta({
  children,
  className,
  testId,
}: {
  children: ReactNode;
  className: string;
  testId?: string;
}) {
  return (
    <button type="button" className={className} data-testid={testId} onClick={() => openPaywall()}>
      {children}
    </button>
  );
}

export function HomeClient() {
  const router = useRouter();
  const [me, setMe] = useState<MeState>({
    signedIn: false,
    id: "",
    name: "",
    email: "",
    ready: false,
    entitlement: null,
  });

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
          id: typeof data.me?.id === "string" ? data.me.id : "",
          name: data.me?.name ?? "",
          email: typeof data.me?.email === "string" ? data.me.email : "",
          ready: true,
          entitlement: data.entitlement ?? null,
        });
      })
      .catch(() => router.replace("/signin"));
  }, [router]);

  const locked = Boolean(me.entitlement && !journalUnlocked(me.entitlement.subscriptionStatus));
  const trialDays = me.entitlement?.daysRemaining;

  return (
    <div className="space-y-6">
      <section className="page-intro home-lockup mx-auto w-fit text-center" data-testid="home-lockup">
        <BrandWordmark as="h1" size="home" />
      </section>

      <FirstHelpTip />

      {me.ready && me.entitlement?.noticeWindow && !locked ? (
        <>
          <TrialNotice anglerId={me.id} entitlement={me.entitlement} placement="home" />
          <TrialNoticeModal anglerId={me.id} entitlement={me.entitlement} />
        </>
      ) : null}

      {me.ready ? (
        <section className="journal-card space-y-2 rounded-2xl p-4" data-testid="home-account">
          <p className="text-sm">
            <span className="font-semibold">{me.name || "Signed in"}</span>
            {me.email ? <span className="mt-0.5 block text-xs text-ink-muted">{me.email}</span> : null}
          </p>
          <p className="text-sm text-ink" data-testid="home-subscription">
            {locked
              ? `Free month ended. Subscribe for ${YEARLY_PRICE_LABEL} to unlock the journal. Your data is safe.`
              : me.entitlement?.subscriptionStatus === "active"
                ? `Journal unlocked. ${YEARLY_PRICE_LABEL} via the App Store when billing ships.`
                : `Free month: ${trialDays ?? "—"} day${trialDays === 1 ? "" : "s"} left. Then ${YEARLY_PRICE_LABEL}.`}
          </p>
          <LogOutButton />
        </section>
      ) : null}

      {locked ? (
        <div data-testid="home-subscribe">
          <Paywall entitlement={me.entitlement} showHomeLink={false} />
        </div>
      ) : (
        <section className="journal-card space-y-2 rounded-2xl p-4" data-testid="home-subscribe">
          <p className="font-display text-xl text-teal">Your journal</p>
          <p className="text-sm text-ink">{TRIAL_OFFER_LINE}</p>
          <p className="text-xs text-ink-muted">Purchase will be through the App Store. Coming with the App Store build.</p>
          <button
            type="button"
            disabled
            className="w-full rounded-2xl bg-copper px-4 py-3 font-semibold text-white disabled:opacity-60"
            data-testid="subscribe-disabled"
          >
            Subscribe — {YEARLY_PRICE_LABEL}
          </button>
        </section>
      )}

      <div className="grid grid-cols-2 gap-2">
        {locked ? (
          <LockedCta className="flex items-center justify-center rounded-2xl bg-copper px-4 py-4 text-center text-lg font-semibold text-white">
            Log a catch
          </LockedCta>
        ) : (
          <Link
            href="/log"
            className="flex items-center justify-center rounded-2xl bg-copper px-4 py-4 text-center text-lg font-semibold text-white"
          >
            Log a catch
          </Link>
        )}
        {locked ? (
          <LockedCta
            className="flex items-center justify-center rounded-2xl bg-teal px-4 py-4 text-center text-lg font-semibold text-white"
            testId="home-log-bait"
          >
            Log bait
          </LockedCta>
        ) : (
          <Link
            href="/bait/new"
            className="flex items-center justify-center rounded-2xl bg-teal px-4 py-4 text-center text-lg font-semibold text-white"
            data-testid="home-log-bait"
          >
            Log bait
          </Link>
        )}
      </div>
      {locked ? (
        <LockedCta className="home-plan-cta flex w-full items-center justify-center rounded-2xl px-4 py-3 text-lg font-semibold">
          Plan a day
        </LockedCta>
      ) : (
        <Link
          href="/plan"
          className="home-plan-cta flex items-center justify-center rounded-2xl px-4 py-3 text-lg font-semibold"
        >
          Plan a day
        </Link>
      )}
      <div className="grid grid-cols-2 gap-2">
        {locked ? (
          <LockedCta className="flex items-center justify-center rounded-2xl border border-line bg-card px-4 py-3 font-semibold">
            Calendar Log
          </LockedCta>
        ) : (
          <Link
            href="/calendar"
            className="flex items-center justify-center rounded-2xl border border-line bg-card px-4 py-3 font-semibold"
          >
            Calendar Log
          </Link>
        )}
        {locked ? (
          <LockedCta className="flex flex-col items-center justify-center rounded-2xl border border-line bg-card px-4 py-3 font-semibold">
            Spots
            <span className="text-xs font-normal text-ink-muted">Catch and bait</span>
          </LockedCta>
        ) : (
          <Link
            href="/spots"
            className="flex flex-col items-center justify-center rounded-2xl border border-line bg-card px-4 py-3 font-semibold"
          >
            Spots
            <span className="text-xs font-normal text-ink-muted">Catch and bait</span>
          </Link>
        )}
      </div>

      <details className="app-more journal-card rounded-2xl">
        <summary className="cursor-pointer px-4 py-3">
          <span>
            <span className="block font-semibold">More</span>
            <span className="mt-0.5 block text-sm font-normal text-ink-muted">
              Account, friends, export, and invite codes
            </span>
          </span>
        </summary>
        <div className="space-y-3 px-4 pb-2">
          <p className="text-sm font-semibold">Account</p>
          <a
            href="/api/export"
            className="block text-sm font-semibold text-teal underline"
            data-testid="home-export"
          >
            Download my log (CSV)
          </a>
          <Link href="/privacy" className="block text-sm font-semibold text-teal underline" data-testid="home-privacy">
            Privacy policy
          </Link>
          <LogOutButton testId="log-out-more" />
        </div>
        <BuddyPanel embedded />
      </details>
    </div>
  );
}
