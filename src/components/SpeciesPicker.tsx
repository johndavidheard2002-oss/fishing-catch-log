"use client";

import { useState } from "react";
import {
  HABITAT_LABELS,
  WATER_TYPE_LABELS,
  catalogHabitat,
  speciesForHabitat,
  waterTypeOf,
  type Habitat,
  type WaterType,
} from "@/lib/habitat";
import { normalizeSpeciesList } from "@/lib/species";

export function SpeciesPicker({
  speciesList,
  habitat,
  onChange,
  onHabitat,
}: {
  speciesList: string[];
  habitat: Habitat;
  onChange: (speciesList: string[], habitat: Habitat) => void;
  onHabitat: (habitat: Habitat) => void;
}) {
  const water = waterTypeOf(habitat);
  const selected = normalizeSpeciesList(null, speciesList);
  const [query, setQuery] = useState("");
  const catalog = speciesForHabitat(habitat);
  const q = query.trim().toLowerCase();
  const filtered = q ? catalog.filter((name) => name.toLowerCase().includes(q)) : catalog;

  function setWater(next: WaterType) {
    if (next === "freshwater") onHabitat("freshwater");
    else if (water !== "saltwater") onHabitat("saltwater-inshore");
  }

  function toggle(name: string) {
    const key = name.trim().toLowerCase();
    const exists = selected.some((s) => s.toLowerCase() === key);
    const next = exists
      ? selected.filter((s) => s.toLowerCase() !== key)
      : [...selected, name.trim()];
    const inferred = catalogHabitat(name);
    onChange(next, inferred && next.length === 1 ? inferred : habitat);
  }

  function addTyped() {
    const name = query.trim();
    if (!name) return;
    toggle(name);
    setQuery("");
  }

  function remove(name: string) {
    onChange(
      selected.filter((s) => s.toLowerCase() !== name.toLowerCase()),
      habitat,
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-sm font-semibold">Water type</p>
        <div className="grid grid-cols-2 gap-2">
          {(["saltwater", "freshwater"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setWater(id)}
              className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${
                water === id ? "bg-teal text-white" : "border border-line bg-card"
              }`}
            >
              {WATER_TYPE_LABELS[id]}
            </button>
          ))}
        </div>
      </div>

      {water === "saltwater" ? (
        <div>
          <p className="mb-1.5 text-sm font-semibold">Saltwater</p>
          <div className="grid grid-cols-2 gap-2">
            {(["saltwater-inshore", "saltwater-offshore"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onHabitat(id)}
                className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${
                  habitat === id ? "bg-teal text-white" : "border border-line bg-card"
                }`}
              >
                {HABITAT_LABELS[id]}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-1 block text-sm font-semibold">Species in this photo</p>
        <p className="mb-2 text-xs text-ink-muted">
          Tag every fish you can see. Tap chips to add or remove — more than one is fine.
        </p>
        {selected.length ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {selected.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => remove(name)}
                className="rounded-full bg-copper px-2.5 py-1 text-xs font-semibold text-white"
              >
                {name} ×
              </button>
            ))}
          </div>
        ) : (
          <p className="mb-2 text-xs text-copper">Add at least one species before you save.</p>
        )}
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTyped();
              }
            }}
            placeholder={`Search ${HABITAT_LABELS[habitat].toLowerCase()} or type a name`}
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          />
          <button
            type="button"
            onClick={addTyped}
            className="shrink-0 rounded-xl border border-line px-3 text-sm font-semibold text-teal"
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-2xl border border-line bg-paper p-2">
        {filtered.length === 0 ? (
          <p className="px-1 py-2 text-xs text-ink-muted">
            No catalog match — type the name and tap Add. Habitat stays{" "}
            {HABITAT_LABELS[habitat].toLowerCase()}.
          </p>
        ) : (
          filtered.map((name) => {
            const on = selected.some((s) => s.toLowerCase() === name.toLowerCase());
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggle(name)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  on ? "bg-copper text-white" : "bg-card text-ink"
                }`}
              >
                {name}
              </button>
            );
          })
        )}
      </div>
      <p className="text-xs text-ink-muted">
        Pick water type first so the list stays short. One picture can hold more than one species.
      </p>
    </div>
  );
}
