"use client";

import { useEffect, useState } from "react";
import { planStorekitAvailable } from "@/lib/native-iap";

/** True only after the 2.0 iOS shell is confirmed. Website and 1.0 stay false. */
export function useNativePlanIap(): { ready: boolean; native: boolean } {
  const [state, setState] = useState({ ready: false, native: false });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setState({ ready: true, native: planStorekitAvailable() });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return state;
}
