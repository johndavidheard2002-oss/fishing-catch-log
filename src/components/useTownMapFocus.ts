"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  shouldLookupTownForMapFocus,
  townMapFocusForName,
  type TownMapCenter,
} from "@/lib/geocode";

export function useTownMapFocus(hasPin = false) {
  const [focusCenter, setFocusCenter] = useState<TownMapCenter | null>(null);
  const lastQuery = useRef("");
  const hasPinRef = useRef(hasPin);
  hasPinRef.current = hasPin;

  useEffect(() => {
    if (!hasPin) return;
    setFocusCenter(null);
    lastQuery.current = "";
  }, [hasPin]);

  const lookupTown = useCallback(async (query: string) => {
    if (!shouldLookupTownForMapFocus(query, hasPinRef.current)) return;
    const q = query.trim();
    if (q.toLowerCase() === lastQuery.current) return;
    lastQuery.current = q.toLowerCase();
    try {
      const res = await fetch("/api/assist/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = (await res.json()) as { center?: TownMapCenter | null };
      const center = townMapFocusForName(data.center, hasPinRef.current);
      if (center) {
        setFocusCenter(center);
        return;
      }
      lastQuery.current = "";
    } catch {
      lastQuery.current = "";
    }
  }, []);

  return { focusCenter, lookupTown };
}
