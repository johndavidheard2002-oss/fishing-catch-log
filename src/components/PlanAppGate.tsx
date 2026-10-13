"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DeleteAccount } from "@/components/DeleteAccount";
import { LogOutButton } from "@/components/LogOutButton";
import { PlanSubscribeScreen } from "@/components/PlanSubscribeScreen";
import { useNativePlanIap } from "@/components/useNativePlanIap";
import { ENTITLEMENT_CHANGED_EVENT, resolvePlanAccess } from "@/lib/native-iap";
import { planAppAccess, planCatchViewPath, planGateAllowsPath, PLAN_READONLY_HOME } from "@/lib/plan-gate";

const PlanReadOnlyContext = createContext(false);

export function usePlanReadOnly(): boolean {
  return useContext(PlanReadOnlyContext);
}

type ServerGate = {
  signedIn: boolean;
  hasCatches: boolean;
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
  const router = useRouter();
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
        .then((data: { signedIn?: boolean; planGate?: { hasCatches?: boolean; subscribed?: boolean } }) => {
          if (cancelled) return;
          setServer({
            signedIn: data.signedIn === true,
            hasCatches: data.planGate?.hasCatches === true,
            subscribed: data.planGate?.subscribed === true,
          });
        })
        .catch(() => {
          if (cancelled) return;
          setServer({ signedIn: true, hasCatches: false, subscribed: false });
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

  const entitled = purchased || server?.subscribed === true || storekitEntitled === true;
  const waiting =
    !allowed &&
    shellNative &&
    !entitled &&
    (server === null || (server.signedIn && storekitEntitled === null && (nativeShell || native)));
  const access =
    !shellNative || allowed || !server?.signedIn
      ? "open"
      : waiting
        ? null
        : planAppAccess({
            native: true,
            hasCatches: server.hasCatches,
            serverSubscribed: server.subscribed,
            storekitEntitled: storekitEntitled === true || purchased,
          });
  const readonlyView = access === "readonly" && planCatchViewPath(pathname);
  const readonlyHome = access === "readonly" && pathname === "/";
  const showPaywall = access === "paywall" || (access === "readonly" && !readonlyView && !readonlyHome);

  useEffect(() => {
    if (!readonlyHome) return;
    router.replace(PLAN_READONLY_HOME);
  }, [readonlyHome, router]);

  useEffect(() => {
    onGatedChange?.(showPaywall || waiting || readonlyHome);
  }, [onGatedChange, readonlyHome, showPaywall, waiting]);

  if (allowed || !shellNative) return children;
  if (!server?.signedIn && server !== null) return children;
  if (access === "open") return children;
  if (readonlyView) {
    return (
      <PlanReadOnlyContext.Provider value={true}>
        <div className="space-y-3" data-testid="plan-readonly">
          <section className="journal-card space-y-2 rounded-2xl p-4" data-testid="plan-readonly-note">
            <p className="text-sm text-ink">These are the catches you already logged. This view is read only.</p>
            <p className="text-sm text-ink-muted">
              Tide Mark Plan is required to log a new catch, and for Plan, the map, and the other tools.
            </p>
            <Link href="/subscribe" className="text-sm font-semibold text-teal underline" data-testid="plan-readonly-subscribe">
              Tide Mark Plan
            </Link>
            <LogOutButton testId="plan-readonly-log-out" />
            <DeleteAccount idPrefix="plan-readonly-delete" />
          </section>
          {children}
        </div>
      </PlanReadOnlyContext.Provider>
    );
  }
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
