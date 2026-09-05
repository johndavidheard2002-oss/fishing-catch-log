"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandWordmark } from "@/components/BrandWordmark";
import {
  YEARLY_PRICE_LABEL,
  journalUnlocked,
  paywallCopy,
  type EntitlementSnapshot,
} from "@/lib/entitlement";
import {
  purchaseAndActivateYearly,
  restoreAndActivateYearly,
  storekitPurchaseAvailable,
} from "@/lib/native-iap";

function pluginErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "App Store purchase failed.";
  const lower = raw.toLowerCase();
  if (lower.includes("cancel")) return "Purchase cancelled.";
  if (lower.includes("no app store subscription") || lower.includes("nothing to restore")) {
    return "No App Store subscription to restore for this Apple ID.";
  }
  return raw;
}

export function SubscribeActions({
  entitlement,
  onActivated,
}: {
  entitlement?: EntitlementSnapshot | null;
  onActivated?: (next: EntitlementSnapshot) => void;
}) {
  const [native, setNative] = useState(false);
  const [busy, setBusy] = useState<"purchase" | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copy = paywallCopy({ native });
  const alreadyActive = entitlement?.subscriptionStatus === "active";

  useEffect(() => {
    setNative(storekitPurchaseAvailable());
  }, []);

  async function run(kind: "purchase" | "restore") {
    if (busy) return;
    setBusy(kind);
    setError(null);
    try {
      const next = kind === "purchase" ? await purchaseAndActivateYearly() : await restoreAndActivateYearly();
      onActivated?.(next);
    } catch (err) {
      setError(pluginErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (!native) {
    return (
      <>
        <button
          type="button"
          disabled
          className="w-full rounded-2xl bg-copper px-4 py-3 text-lg font-semibold text-white disabled:opacity-60"
          data-testid="subscribe-disabled"
        >
          {copy.subscribeLabel}
        </button>
        <p className="text-xs text-ink-muted">{copy.storeNote}</p>
      </>
    );
  }

  return (
    <div className="space-y-2">
      {alreadyActive && entitlement && journalUnlocked(entitlement.subscriptionStatus) ? (
        <p className="text-sm font-semibold text-ink" data-testid="subscribe-active">
          Tide Mark Premium is active on this journal.
        </p>
      ) : (
        <button
          type="button"
          disabled={busy != null}
          className="w-full rounded-2xl bg-copper px-4 py-3 text-lg font-semibold text-white disabled:opacity-60"
          data-testid="subscribe-yearly"
          onClick={() => void run("purchase")}
        >
          {busy === "purchase" ? "Purchasing…" : copy.subscribeLabel}
        </button>
      )}
      <button
        type="button"
        disabled={busy != null}
        className="w-full rounded-2xl border border-line bg-card px-4 py-3 font-semibold disabled:opacity-60"
        data-testid="restore-purchases"
        onClick={() => void run("restore")}
      >
        {busy === "restore" ? "Restoring…" : copy.restoreLabel}
      </button>
      <p className="text-xs text-ink-muted">{copy.storeNote}</p>
      {error ? (
        <p className="text-sm text-copper" data-testid="storekit-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Paywall({
  entitlement,
  onClose,
  onActivated,
  variant = "page",
  showHomeLink = true,
}: {
  entitlement?: EntitlementSnapshot | null;
  onClose?: () => void;
  onActivated?: (next: EntitlementSnapshot) => void;
  variant?: "page" | "modal";
  showHomeLink?: boolean;
}) {
  const copy = paywallCopy();
  const price = entitlement?.yearlyPrice ?? YEARLY_PRICE_LABEL;

  return (
    <section
      className={`journal-card space-y-3 rounded-2xl p-4 ${variant === "modal" ? "max-h-full overflow-y-auto" : ""}`}
      data-testid="subscribe-paywall"
    >
      <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{copy.subtitle}</p>
      <BrandWordmark size="header" />
      <h2 className="font-display text-2xl text-teal">{copy.headline}</h2>
      <p className="text-sm text-ink">{copy.body}</p>
      <p className="text-sm font-semibold text-ink">
        Tide Mark is {price} after the free month. Your log stays on this account.
      </p>
      <SubscribeActions entitlement={entitlement} onActivated={onActivated} />
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-2xl border border-line bg-card px-4 py-3 font-semibold"
          data-testid="paywall-close"
        >
          Back to Home
        </button>
      ) : showHomeLink ? (
        <Link
          href="/"
          className="flex w-full items-center justify-center rounded-2xl border border-line bg-card px-4 py-3 font-semibold"
          data-testid="paywall-home"
        >
          Back to Home
        </Link>
      ) : null}
    </section>
  );
}
