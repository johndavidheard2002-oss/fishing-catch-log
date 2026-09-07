"use client";

import { useCallback, useRef, useState } from "react";
import { shouldGeocodeTownQuery, type TownMapCenter } from "@/lib/geocode";

export function useTownMapFocus() {
  const [focusCenter, setFocusCenter] = useState<TownMapCenter | null>(null);
  const lastQuery = useRef("");

  const lookupTown = useCallback(async (query: string) => {
    const q = query.trim();
    if (!shouldGeocodeTownQuery(q)) return;
    if (q.toLowerCase() === lastQuery.current) return;
    lastQuery.current = q.toLowerCase();
    try {
      const res = await fetch("/api/assist/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = (await res.json()) as { center?: TownMapCenter | null };
      if (data.center) {
        setFocusCenter(data.center);
        return;
      }
      lastQuery.current = "";
    } catch {
      lastQuery.current = "";
    }
  }, []);

  return { focusCenter, lookupTown };
}
