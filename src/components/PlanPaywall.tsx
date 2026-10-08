"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandWordmark } from "@/components/BrandWordmark";
import { purchasePlan, restorePlan } from "@/lib/native-iap";
import {
  PLAN_TERMS_URL,
  planPaywallCopy,
  type PlanOffer,
} from "@/lib/plan-iap";

function pluginErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "App Store purchase failed.";
  const lower = raw.toLowerCase();
  if (lower.includes("cancel")) return "Purchase cancelled.";
  if (lower.includes("pending")) return "Purchase is pending approval.";
  if (lower.includes("has ended")) return "That Plan subscription has ended.";
  if (lower.includes("no app store subscription") || lower.includes("nothing to restore")) {
    return "No App Store subscription to restore for this Apple ID.";
  }
  return raw;
}

export function PlanPaywall({
  offer,
  onUnlocked,
  onRetry,
  priceFromStore = true,
}: {
  offer: PlanOffer;
  onUnlocked?: (next: PlanOffer) => void;
  onRetry?: () => void;
  priceFromStore?: boolean;
}) {
  const [busy, setBusy] = useState<"purchase" | "restore" | "retry" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copy = planPaywallCopy(offer);
  const ended = offer.status === "expired";
  const active = offer.entitled && offer.status === "active";

  async function retry() {
    if (!onRetry || busy) return;
    setBusy("retry");
    setError(null);
    try {
      await onRetry();
    } finally {
      setBusy(null);
    }
  }

  async function run(kind: "purchase" | "restore") {
    if (busy) return;
    setBusy(kind);
    setError(null);
    try {
      const next = kind === "purchase" ? await purchasePlan() : await restorePlan();
      onUnlocked?.(next);
    } catch (err) {
      setError(pluginErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="journal-card space-y-3 rounded-2xl p-4" data-testid="plan-paywall">
      <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Auto-renewable subscription</p>
      <BrandWordmark size="header" />
      <h1 className="font-display text-3xl text-teal" data-testid="plan-paywall-title">
        {copy.title}
      </h1>
      <p className="text-sm text-ink" data-testid="plan-paywall-price">
        {copy.trial}. Length: {copy.length}.
      </p>
      {active ? (
        <p className="text-sm text-ink" data-testid="plan-paywall-active">
          Your Tide Mark Plan subscription is active. The offer below stays available.
        </p>
      ) : null}
      {!priceFromStore ? (
        <p className="text-sm text-ink" data-testid="plan-price-fallback">
          The App Store price did not load. The price shown is {copy.price}.
        </p>
      ) : null}
      {ended ? (
        <p className="text-sm text-ink" data-testid="plan-paywall-ended">
          Your Plan subscription has ended.
        </p>
      ) : null}
      <ul className="space-y-1 text-sm text-ink" data-testid="plan-paywall-includes">
        {copy.includes.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="text-xs text-ink-muted" data-testid="plan-paywall-autorenew">
        {copy.autoRenew}
      </p>
      {onRetry ? (
        <button
          type="button"
          disabled={busy != null}
          className="w-full rounded-2xl border border-line bg-card px-4 py-3 font-semibold disabled:opacity-60"
          data-testid="plan-price-retry"
          onClick={() => void retry()}
        >
          {busy === "retry" ? "Retrying…" : "Retry"}
        </button>
      ) : null}
      <button
        type="button"
        disabled={busy != null}
        className="w-full rounded-2xl bg-copper px-4 py-3 text-lg font-semibold text-white disabled:opacity-60"
        data-testid="plan-subscribe"
        onClick={() => void run("purchase")}
      >
        {busy === "purchase" ? "Purchasing…" : copy.subscribeLabel}
      </button>
      <button
        type="button"
        disabled={busy != null}
        className="w-full rounded-2xl border border-line bg-card px-4 py-3 font-semibold disabled:opacity-60"
        data-testid="plan-restore"
        onClick={() => void run("restore")}
      >
        {busy === "restore" ? "Restoring…" : copy.restoreLabel}
      </button>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
        <a
          href={PLAN_TERMS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-teal underline"
          data-testid="plan-terms"
        >
          Terms of Use
        </a>
        <Link href="/privacy" className="text-teal underline" data-testid="plan-privacy">
          Privacy Policy
        </Link>
      </p>
      {error ? (
        <p className="text-sm text-copper" data-testid="plan-storekit-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
