"use client";

import { useEffect, useRef, useState } from "react";
import { areaNameKey } from "@/lib/areas";
import { TOWN_LOOKUP_DEBOUNCE_MS } from "@/lib/geocode";
import type { NamedArea } from "@/lib/types";

export function AreaNamePicker({
  value,
  onChange,
  onPickArea,
  onLookupTown,
}: {
  value: string;
  onChange: (placeName: string) => void;
  onPickArea: (area: NamedArea) => void;
  onLookupTown?: (query: string) => void;
}) {
  const [areas, setAreas] = useState<NamedArea[] | null>(null);
  const [showPast, setShowPast] = useState(false);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (lookupTimer.current) clearTimeout(lookupTimer.current);
    },
    [],
  );

  function scheduleLookup(query: string) {
    if (!onLookupTown) return;
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    lookupTimer.current = setTimeout(() => onLookupTown(query), TOWN_LOOKUP_DEBOUNCE_MS);
  }

  function flushLookup(query: string) {
    if (!onLookupTown) return;
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    lookupTimer.current = null;
    onLookupTown(query);
  }

  function loadAreas() {
    fetch("/api/areas", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setAreas((data.areas ?? []) as NamedArea[]))
      .catch(() => setAreas([]));
  }

  const selectedKey = areaNameKey(value);
  const chips = (areas ?? []).slice(0, 12);

  return (
    <div className="space-y-2" data-testid="named-area-picker">
      <label className="block">
        <span className="on-wash-chip mb-1 inline-block text-sm font-semibold">Area name</span>
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            scheduleLookup(e.target.value);
          }}
          onBlur={() => flushLookup(value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            flushLookup(value);
          }}
          placeholder="Town or area name"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-xl border border-line bg-card px-3 py-3"
        />
      </label>
      <p className="on-wash-chip text-xs">Type a town to move the map, then tap to drop the pin.</p>
      <details
        className="text-xs"
        onToggle={(e) => {
          const open = e.currentTarget.open;
          setShowPast(open);
          if (open && areas == null) loadAreas();
        }}
      >
        <summary className="on-wash-chip w-fit cursor-pointer text-teal">Reuse a past name</summary>
        {showPast ? (
          <div className="mt-2">
            {areas == null ? (
              <p className="on-wash-chip w-fit text-xs">Loading names…</p>
            ) : chips.length ? (
              <div className="flex flex-wrap gap-1.5" data-testid="named-area-chips">
                {chips.map((area) => {
                  const selected = areaNameKey(area.name) === selectedKey && Boolean(selectedKey);
                  return (
                    <button
                      key={`${area.source}-${area.id ?? area.name}`}
                      type="button"
                      data-testid="named-area-chip"
                      onClick={() => {
                        const next = { ...area, latitude: null, longitude: null };
                        onPickArea(next);
                        flushLookup(area.name);
                      }}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        selected ? "bg-teal text-white" : "border border-line bg-card"
                      }`}
                    >
                      {area.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="on-wash-chip w-fit text-xs">No saved names yet.</p>
            )}
          </div>
        ) : null}
      </details>
    </div>
  );
}
