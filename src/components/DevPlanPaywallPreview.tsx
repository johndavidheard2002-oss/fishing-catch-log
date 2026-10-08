"use client";

import { useState } from "react";
import { PlanPaywall } from "@/components/PlanPaywall";
import { fallbackPlanOffer } from "@/lib/plan-iap";

/** Dev-only paywall with the missing-price retry state. */
export function DevPlanPaywallPreview() {
  const [tries, setTries] = useState(0);
  return (
    <div className="space-y-3">
      <PlanPaywall
        offer={fallbackPlanOffer()}
        priceFromStore={false}
        onRetry={async () => {
          setTries((count) => count + 1);
        }}
      />
      <p className="text-sm text-ink-muted" data-testid="plan-price-retry-count">
        Retries: {tries}
      </p>
    </div>
  );
}
