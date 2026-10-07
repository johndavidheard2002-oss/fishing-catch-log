"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PlanPaywall } from "@/components/PlanPaywall";
import { planStorekitAvailable, resolvePlanAccess } from "@/lib/native-iap";
import { fallbackPlanOffer, type PlanOffer } from "@/lib/plan-iap";

type Phase = "open" | "checking" | "paywall" | "unlocked";

/**
 * Plan stays fully open on the website and in the 1.0 app.
 * The paywall mounts only after the 2.0 shell confirms StoreKit Plan.
 */
export function PlanAccess({
  children,
  preview = false,
}: {
  children: ReactNode;
  preview?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>(preview ? "paywall" : "open");
  const [offer, setOffer] = useState<PlanOffer>(fallbackPlanOffer);

  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    let phaseNow: Phase = "open";

    async function refresh() {
      if (!planStorekitAvailable()) {
        phaseNow = "open";
        setPhase("open");
        return;
      }
      if (phaseNow === "open") {
        phaseNow = "checking";
        setPhase("checking");
      }
      const access = await resolvePlanAccess();
      if (cancelled) return;
      if (access.mode === "free") {
        phaseNow = "open";
        setPhase("open");
        return;
      }
      phaseNow = access.mode;
      setOffer(access.offer);
      setPhase(access.mode);
    }

    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    function onVisible() {
      if (document.visibilityState === "visible") void refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [preview]);

  if (phase === "checking") {
    return (
      <p className="text-sm text-ink-muted" data-testid="plan-iap-checking">
        Checking your Plan subscription…
      </p>
    );
  }

  if (phase === "paywall") {
    return (
      <PlanPaywall
        offer={offer}
        onUnlocked={(next) => {
          setOffer(next);
          setPhase("unlocked");
        }}
      />
    );
  }

  return children;
}
