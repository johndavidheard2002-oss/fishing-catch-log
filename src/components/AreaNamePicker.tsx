"use client";

import { useState } from "react";
import { areaNameKey } from "@/lib/areas";
import type { NamedArea } from "@/lib/types";

export function AreaNamePicker({
  value,
  latitude,
  longitude,
  onChange,
  onPickArea,
}: {
  value: string;
  latitude: number | null;
  longitude: number | null;
  onChange: (placeName: string) => void;
  onPickArea: (area: NamedArea) => void;
}) {
  const [areas, setAreas] = useState<NamedArea[] | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadAreas() {
    fetch("/api/areas", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setAreas((data.areas ?? []) as NamedArea[]))
      .catch(() => setAreas([]));
  }

  const selectedKey = areaNameKey(value);
  const chips = (areas ?? []).slice(0, 12);

  async function saveNamedArea() {
    const name = draft.trim() || value.trim();
    if (!name) {
      setError("Type a name for this area.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          latitude,
          longitude,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save the area");
      const area = data.area as NamedArea;
      onPickArea(area);
      setNaming(false);
      setDraft("");
      if (showPast) loadAreas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the area");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2" data-testid="named-area-picker">
      <p className="on-wash-chip text-sm font-semibold">Area</p>
      <p className="on-wash-chip text-xs">
        Name it yourself. If the map already has a place name for this pin, it fills in — you can
        still change it.
      </p>
      <label className="block">
        <span className="on-wash-chip mb-1 inline-block text-sm font-semibold">Place name</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Name this area"
          className="w-full rounded-xl border border-line bg-card px-3 py-3"
        />
      </label>
      {showPast ? (
        chips.length ? (
          <div className="flex flex-wrap gap-1.5" data-testid="named-area-chips">
            {chips.map((area) => {
              const selected = areaNameKey(area.name) === selectedKey && Boolean(selectedKey);
              return (
                <button
                  key={`${area.source}-${area.id ?? area.name}`}
                  type="button"
                  data-testid="named-area-chip"
                  onClick={() => onPickArea({ ...area, latitude: null, longitude: null })}
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
          <p className="on-wash-chip text-xs">No saved names yet.</p>
        )
      ) : (
        <button
          type="button"
          className="on-wash-chip w-fit text-xs font-semibold text-teal"
          onClick={() => {
            setShowPast(true);
            loadAreas();
          }}
        >
          Reuse a past name
        </button>
      )}
      {naming ? (
        <div className="space-y-2 rounded-2xl border border-line bg-paper px-3 py-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Save this name</span>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="The point, shrimp hole…"
              className="w-full rounded-xl border border-line bg-card px-3 py-3"
              autoFocus
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveNamedArea}
              disabled={saving}
              className="rounded-full bg-teal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save name"}
            </button>
            <button
              type="button"
              onClick={() => {
                setNaming(false);
                setError(null);
              }}
              className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          data-testid="name-this-area"
          onClick={() => {
            setDraft(value);
            setNaming(true);
            setError(null);
          }}
          className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold text-teal"
        >
          Save this name for later
        </button>
      )}
      {error ? <p className="text-xs text-copper">{error}</p> : null}
    </div>
  );
}
