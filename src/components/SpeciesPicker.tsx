"use client";

import { useState } from "react";
import {
  HABITAT_LABELS,
  speciesForHabitat,
  catalogHabitat,
  type Habitat,
} from "@/lib/habitat";
import { normalizeSpeciesList } from "@/lib/species";

const SALT_OPTIONS: Habitat[] = ["saltwater-inshore", "saltwater-offshore"];

function pickerHabitat(habitat: Habitat): Habitat {
  return habitat === "saltwater-offshore" ? "saltwater-offshore" : "saltwater-inshore";
}

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
  const selected = normalizeSpeciesList(null, speciesList);
  const [query, setQuery] = useState("");
  const listHabitat = pickerHabitat(habitat);
  const catalog = speciesForHabitat(listHabitat);
  const q = query.trim().toLowerCase();
  const filtered = q ? catalog.filter((name) => name.toLowerCase().includes(q)) : catalog;
  const saltSelected = habitat === "saltwater-offshore" || habitat === "saltwater-inshore";

  function toggle(name: string) {
    const key = name.trim().toLowerCase();
    const exists = selected.some((s) => s.toLowerCase() === key);
    const next = exists
      ? selected.filter((s) => s.toLowerCase() !== key)
      : [...selected, name.trim()];
    const inferred = catalogHabitat(name);
    const nextHabitat =
      inferred && next.length === 1 && inferred !== "freshwater" ? inferred : habitat;
    onChange(next, nextHabitat);
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
        <p className="on-wash-chip mb-1.5 w-fit text-sm font-semibold">Water</p>
        <div className="grid grid-cols-2 gap-2">
          {SALT_OPTIONS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onHabitat(id)}
              className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${
                saltSelected && habitat === id ? "bg-teal text-white" : "border border-line bg-card"
              }`}
            >
              {HABITAT_LABELS[id]}
            </button>
          ))}
        </div>
        {habitat === "freshwater" ? (
          <p className="on-wash-chip mt-1.5 text-xs">
            This older trip is not inshore or offshore yet. Pick one to recategorize, or leave it.
          </p>
        ) : null}
      </div>

      <div>
        <p className="on-wash-chip mb-1 w-fit text-sm font-semibold">Species in this photo</p>
        <p className="on-wash-chip mb-2 text-xs">
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
          <p className="on-wash-chip mb-2 text-xs text-copper">Add at least one species before you save.</p>
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
            placeholder={`Search ${HABITAT_LABELS[listHabitat].toLowerCase()} or type a name`}
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
            {HABITAT_LABELS[listHabitat].toLowerCase()}.
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
      <p className="on-wash-chip text-xs">
        Inshore or offshore first so the list stays short. One picture can hold more than one
        species.
      </p>
    </div>
  );
}
