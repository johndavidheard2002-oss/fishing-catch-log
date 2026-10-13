"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNativePlanIap } from "@/components/useNativePlanIap";
import { ENTITLEMENT_CHANGED_EVENT, refreshPlanEntitlement } from "@/lib/native-iap";
import { PLAN_SUBSCRIBE_CARD_TITLE, planAppAccess, planGateAllowsPath } from "@/lib/plan-gate";
import { PLAN_OFFER_LINE } from "@/lib/plan-iap";

const PlanLoggingLockedContext = createContext(false);

export function usePlanLoggingLocked(): boolean {
  return useContext(PlanLoggingLockedContext);
}

/** Tide Mark Plan subscription card. Opens the purchase screen. */
export function PlanSubscribeCard() {
  const locked = usePlanLoggingLocked();
  if (!locked) return null;
  return (
    <section className="journal-card space-y-2 rounded-2xl p-4" data-testid="plan-subscribe-card">
      <p className="font-display text-xl text-teal">{PLAN_SUBSCRIBE_CARD_TITLE}</p>
      <p className="text-sm text-ink">
        Subscription required for Tide Mark. {PLAN_OFFER_LINE}.
      </p>
      <Link
        href="/subscribe"
        className="flex w-full items-center justify-center rounded-2xl bg-copper px-4 py-3 text-center font-semibold text-white"
        data-testid="plan-subscribe-card-open"
      >
        Subscribe
      </Link>
    </section>
  );
}

type ServerGate = {
  signedIn: boolean;
  comped: boolean;
};

export function PlanAppGate({
  nativeShell,
  onGatedChange,
  children,
}: {
  nativeShell: boolean;
  onGatedChange?: (gated: boolean) => void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { ready, native } = useNativePlanIap();
  const [server, setServer] = useState<ServerGate | null>(null);
  const [storekitEntitled, setStorekitEntitled] = useState<boolean | null>(null);
  const allowed = planGateAllowsPath(pathname);
  const shellNative = nativeShell || native;

  useEffect(() => {
    onGatedChange?.(false);
  }, [onGatedChange]);

  useEffect(() => {
    if (!shellNative || allowed) return;
    let cancelled = false;
    function load() {
      fetch("/api/me", { cache: "no-store" })
        .then((response) => response.json())
        .then((data: { signedIn?: boolean; planComped?: boolean }) => {
          if (cancelled) return;
          setServer({ signedIn: data.signedIn === true, comped: data.planComped === true });
        })
        .catch(() => {
          if (cancelled) return;
          setServer({ signedIn: true, comped: false });
        });
    }
    load();
    function onEntitlement() {
      load();
    }
    window.addEventListener(ENTITLEMENT_CHANGED_EVENT, onEntitlement);
    return () => {
      cancelled = true;
      window.removeEventListener(ENTITLEMENT_CHANGED_EVENT, onEntitlement);
    };
  }, [allowed, shellNative]);

  useEffect(() => {
    if (!shellNative || allowed || !ready || !native) return;
    let cancelled = false;
    async function refresh() {
      try {
        const entitled = await refreshPlanEntitlement();
        if (!cancelled) setStorekitEntitled(entitled);
      } catch {
        if (!cancelled) setStorekitEntitled(false);
      }
    }
    void refresh();
    function onResume() {
      if (document.visibilityState === "hidden") return;
      void refresh();
    }
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("pageshow", onResume);
    window.addEventListener("focus", onResume);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("pageshow", onResume);
      window.removeEventListener("focus", onResume);
    };
  }, [allowed, native, ready, shellNative]);

  const nativeGate = shellNative && !allowed;
  const signedOut = server?.signedIn === false;
  const comped = server?.comped === true;
  const entitled = storekitEntitled === true;
  const loggingLocked = nativeGate && !signedOut && !comped && !entitled;
  const showCard = nativeGate && server != null && !signedOut && !comped && storekitEntitled === false;
  const access = !nativeGate || signedOut || entitled
    ? "open"
    : planAppAccess({ native: true, storekitEntitled: false });

  return (
    <PlanLoggingLockedContext.Provider value={loggingLocked || access === "locked"}>
      {showCard ? <PlanSubscribeCard /> : null}
      {children}
    </PlanLoggingLockedContext.Provider>
  );
}
