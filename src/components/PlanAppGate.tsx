"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useNativePlanIap } from "@/components/useNativePlanIap";
import { ENTITLEMENT_CHANGED_EVENT, resolvePlanAccess } from "@/lib/native-iap";
import { PLAN_LOGGING_NOTE, planAppAccess, planGateAllowsPath } from "@/lib/plan-gate";

const PlanLoggingLockedContext = createContext(false);

export function usePlanLoggingLocked(): boolean {
  return useContext(PlanLoggingLockedContext);
}

/** Short non-link note. It never opens the purchase screen. */
export function PlanLoggingNote() {
  const locked = usePlanLoggingLocked();
  if (!locked) return null;
  return (
    <p className="text-sm text-ink-muted" data-testid="plan-logging-note">
      {PLAN_LOGGING_NOTE}
    </p>
  );
}

type ServerGate = {
  signedIn: boolean;
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
        .then((data: { signedIn?: boolean; planGate?: { subscribed?: boolean } }) => {
          if (cancelled) return;
          setServer({
            signedIn: data.signedIn === true,
            subscribed: data.planGate?.subscribed === true,
          });
        })
        .catch(() => {
          if (cancelled) return;
          setServer({ signedIn: true, subscribed: false });
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

  const entitled = server?.subscribed === true || storekitEntitled === true;
  const access =
    !shellNative || allowed || server?.signedIn === false
      ? "open"
      : server === null || (server.signedIn && !entitled && storekitEntitled === null)
        ? "locked"
        : planAppAccess({
            native: true,
            serverSubscribed: server.subscribed,
            storekitEntitled: storekitEntitled === true,
          });

  return <PlanLoggingLockedContext.Provider value={access === "locked"}>{children}</PlanLoggingLockedContext.Provider>;
}
