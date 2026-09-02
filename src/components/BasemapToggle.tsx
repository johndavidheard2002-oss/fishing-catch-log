"use client";

import { DEFAULT_MAP_STYLE, type MapStyle } from "@/lib/map-tiles";

export function BasemapToggle({
  value = DEFAULT_MAP_STYLE,
  onChange,
}: {
  value?: MapStyle;
  onChange: (style: MapStyle) => void;
}) {
  return (
    <div className="absolute bottom-2 left-2 z-[1000] flex overflow-hidden rounded-lg border border-white/40 bg-card/95 text-xs font-semibold shadow-md">
      <button
        type="button"
        onClick={() => onChange("satellite")}
        className={`min-h-9 px-3 py-1.5 ${
          value === "satellite" ? "bg-teal text-white" : "text-ink"
        }`}
      >
        Satellite
      </button>
      <button
        type="button"
        onClick={() => onChange("street")}
        className={`min-h-9 px-3 py-1.5 ${
          value === "street" ? "bg-teal text-white" : "text-ink"
        }`}
      >
        Street
      </button>
    </div>
  );
}
