"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DeleteAccount } from "@/components/DeleteAccount";
import { LogOutButton } from "@/components/LogOutButton";
import { PlanSubscribeScreen } from "@/components/PlanSubscribeScreen";
import { useNativePlanIap } from "@/components/useNativePlanIap";
import { ENTITLEMENT_CHANGED_EVENT, resolvePlanAccess } from "@/lib/native-iap";
import { planAppAccess, planGateAllowsPath } from "@/lib/plan-gate";

type ServerGate = {
  signedIn: boolean;
  grandfathered: boolean;
  subscribed: boolean;
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
  const [purchased, setPurchased] = useState(false);
  const allowed = planGateAllowsPath(pathname);
  const shellNative = nativeShell || native;

  useEffect(() => {
    if (!shellNative || allowed) return;
    let cancelled = false;
    function load() {
      fetch("/api/me", { cache: "no-store" })
        .then((response) => response.json())
        .then((data: { signedIn?: boolean; planGate?: { grandfathered?: boolean; subscribed?: boolean } }) => {
          if (cancelled) return;
          setServer({
            signedIn: data.signedIn === true,
            grandfathered: data.planGate?.grandfathered === true,
            subscribed: data.planGate?.subscribed === true,
          });
        })
        .catch(() => {
          if (cancelled) return;
          setServer({ signedIn: true, grandfathered: false, subscribed: false });
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
    resolvePlanAccess()
      .then((access) => {
        if (!cancelled) setStorekitEntitled(access.mode === "unlocked");
      })
      .catch(() => {
        if (!cancelled) setStorekitEntitled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, native, ready, shellNative]);

  const knownOpen =
    purchased ||
    server?.grandfathered === true ||
    server?.subscribed === true ||
    storekitEntitled === true;
  const waiting =
    !allowed &&
    shellNative &&
    !knownOpen &&
    (server === null || (server.signedIn && storekitEntitled === null && (nativeShell || native)));
  const showPaywall =
    !allowed &&
    shellNative &&
    server?.signedIn === true &&
    !waiting &&
    planAppAccess({
      native: true,
      grandfathered: server.grandfathered,
      serverSubscribed: server.subscribed,
      storekitEntitled: storekitEntitled === true || purchased,
    }) === "paywall";

  useEffect(() => {
    onGatedChange?.(showPaywall || waiting);
  }, [onGatedChange, showPaywall, waiting]);

  if (allowed || !shellNative) return children;
  if (!server?.signedIn && server !== null) return children;
  if (knownOpen && !showPaywall) return children;
  if (showPaywall) {
    return (
      <div className="space-y-4" data-testid="plan-app-gate">
        <PlanSubscribeScreen
          onUnlocked={() => {
            setPurchased(true);
            setStorekitEntitled(true);
          }}
        />
        <section className="journal-card space-y-2 rounded-2xl p-4" data-testid="plan-gate-account">
          <p className="text-sm text-ink">Delete this account anytime. A subscription is not required.</p>
          <LogOutButton testId="plan-gate-log-out" />
          <DeleteAccount idPrefix="plan-gate-delete" />
        </section>
      </div>
    );
  }
  return (
    <p className="on-wash-chip text-sm" data-testid="plan-gate-opening">
      Opening Tide Mark…
    </p>
  );
}
