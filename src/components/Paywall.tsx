"use client";

import Link from "next/link";
import { BrandWordmark } from "@/components/BrandWordmark";
import {
  YEARLY_PRICE_LABEL,
  paywallCopy,
  type EntitlementSnapshot,
} from "@/lib/entitlement";

export function Paywall({
  entitlement,
  onClose,
  variant = "page",
  showHomeLink = true,
}: {
  entitlement?: EntitlementSnapshot | null;
  onClose?: () => void;
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
      <button
        type="button"
        disabled
        className="w-full rounded-2xl bg-copper px-4 py-3 text-lg font-semibold text-white disabled:opacity-60"
        data-testid="subscribe-disabled"
      >
        {copy.subscribeLabel}
      </button>
      <p className="text-xs text-ink-muted">{copy.storeNote}</p>
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
