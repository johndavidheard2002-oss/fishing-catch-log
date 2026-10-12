"use client";

import { useEffect, useState } from "react";
import { formatPlanIapDiagnostics, planIapDiagnostics, planStorekitAvailable } from "@/lib/native-iap";

/** True when this WebView is Tide Mark 2.0. The website and 1.0 stay false. */
export function useNativePlanIap(): { ready: boolean; native: boolean; diagnostics: string } {
  const [state, setState] = useState({ ready: false, native: false, diagnostics: "" });

  useEffect(() => {
    function read() {
      const flags = planIapDiagnostics();
      const native = planStorekitAvailable();
      setState((prev) => ({
        ready: true,
        native: prev.native || native,
        diagnostics: formatPlanIapDiagnostics(flags),
      }));
    }
    const immediate = window.setTimeout(read, 0);
    const latePlugin = window.setTimeout(read, 400);
    return () => {
      window.clearTimeout(immediate);
      window.clearTimeout(latePlugin);
    };
  }, []);

  return state;
}
