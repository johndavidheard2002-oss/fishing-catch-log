"use client";

import { useCallback, useEffect, useState } from "react";
import { PlanPaywall } from "@/components/PlanPaywall";
import { useNativePlanIap } from "@/components/useNativePlanIap";
import { fetchPlanOffer } from "@/lib/native-iap";
import { PLAN_TITLE, fallbackPlanOffer, planDiagnosticsRequested, type PlanOffer } from "@/lib/plan-iap";

/**
 * Purchase screen for Tide Mark 2.0. The website and the 1.0 app never see
 * Subscribe or Restore. A missing StoreKit price still shows the US price.
 */
export function PlanSubscribeScreen() {
  const { ready, native, diagnostics } = useNativePlanIap();
  const [offer, setOffer] = useState<PlanOffer>(fallbackPlanOffer());
  const [priceFromStore, setPriceFromStore] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await fetchPlanOffer();
      setOffer(next);
      setPriceFromStore(Boolean(next.displayPrice));
    } catch {
      setOffer(fallbackPlanOffer());
      setPriceFromStore(false);
    }
  }, []);

  useEffect(() => {
    if (!native) return;
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [native, load]);

  const showDiagnostics =
    ready && planDiagnosticsRequested(typeof window === "undefined" ? "" : window.location.search);
  const diagnosticsLine = showDiagnostics ? (
    <p className="text-[11px] leading-snug text-ink-muted" data-testid="plan-iap-diagnostics">
      {diagnostics}
    </p>
  ) : null;

  if (!ready) {
    return (
      <div className="w-full min-w-0 space-y-3">
        <p className="text-sm text-ink-muted" data-testid="plan-subscribe-opening">
          Opening {PLAN_TITLE}…
        </p>
      </div>
    );
  }

  if (!native) {
    return (
      <div className="w-full min-w-0 space-y-3">
        {diagnosticsLine}
        <section className="journal-card w-full space-y-2 rounded-2xl p-4" data-testid="plan-included">
          <h1 className="font-display text-3xl text-teal">{PLAN_TITLE}</h1>
          <p className="text-sm text-ink">
            Tide Mark Plan is included in this version. The website and Tide Mark 1.0 do not sell a separate
            subscription.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-3">
      {diagnosticsLine}
      <PlanPaywall
        offer={offer}
        priceFromStore={priceFromStore !== false}
        onRetry={priceFromStore === false ? () => void load() : undefined}
        onUnlocked={(next) => {
          setOffer(next);
          setPriceFromStore(Boolean(next.displayPrice));
        }}
      />
    </div>
  );
}
