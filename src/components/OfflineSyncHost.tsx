"use client";

import { useEffect } from "react";
import { journalUnlocked, type EntitlementSnapshot } from "@/lib/entitlement";
import { OFFLINE_SHELL_PATHS, isBrowserOnline } from "@/lib/offline";
import { syncQueuedLogsIfOnline } from "@/lib/offline-sync";

export function OfflineSyncHost({
  entitlement,
}: {
  entitlement?: EntitlementSnapshot | null;
}) {
  useEffect(() => {
    function run() {
      if (!isBrowserOnline()) return;
      if (entitlement && !journalUnlocked(entitlement.subscriptionStatus)) return;
      void syncQueuedLogsIfOnline({ entitlement: entitlement ?? null });
    }
    run();
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", run);
    return () => {
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", run);
    };
  }, [entitlement]);

  useEffect(() => {
    if (!isBrowserOnline()) return;
    for (const path of OFFLINE_SHELL_PATHS) {
      void fetch(path, { credentials: "same-origin" }).catch(() => {});
    }
  }, []);

  return null;
}
