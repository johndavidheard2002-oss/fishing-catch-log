"use client";

import { useState } from "react";
import { PlanPaywall } from "@/components/PlanPaywall";
import { fallbackPlanOffer } from "@/lib/plan-iap";

/** Dev-only paywall. `priceFromStore` mocks a loaded StoreKit product. */
export function DevPlanPaywallPreview({ priceFromStore = false }: { priceFromStore?: boolean }) {
  const [tries, setTries] = useState(0);
  const offer = priceFromStore
    ? { ...fallbackPlanOffer(), displayPrice: "$19.99", displayName: "Tide Mark Plan" }
    : fallbackPlanOffer();
  return (
    <div className="space-y-3">
      <PlanPaywall
        offer={offer}
        priceFromStore={priceFromStore}
        onRetry={
          priceFromStore
            ? undefined
            : async () => {
                setTries((count) => count + 1);
              }
        }
      />
      {priceFromStore ? null : (
        <p className="text-sm text-ink-muted" data-testid="plan-price-retry-count">
          Retries: {tries}
        </p>
      )}
    </div>
  );
}
