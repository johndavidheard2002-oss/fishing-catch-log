"use client";

import { useState } from "react";
import {
  HABITAT_LABELS,
  catalogHabitat,
  isSaltwaterCatalogSpecies,
  speciesForHabitat,
  type Habitat,
} from "@/lib/habitat";
import { matchSaltwaterCatalogSpecies, normalizeSpeciesList } from "@/lib/species";

const SALT_OPTIONS: Habitat[] = ["saltwater-inshore", "saltwater-offshore"];

function pickerHabitat(habitat: Habitat): Habitat {
  return habitat === "saltwater-offshore" ? "saltwater-offshore" : "saltwater-inshore";
}

export function SpeciesPicker({
  speciesList,
  habitat,
  onChange,
  onHabitat,
  hideHints = false,
}: {
  speciesList: string[];
  habitat: Habitat;
  onChange: (speciesList: string[], habitat: Habitat) => void;
  onHabitat: (habitat: Habitat) => void;
  hideHints?: boolean;
}) {
  const selected = normalizeSpeciesList(null, speciesList);
  const [query, setQuery] = useState("");
  const listHabitat = pickerHabitat(habitat);
  const catalog = speciesForHabitat(listHabitat);
  const q = query.trim().toLowerCase();
  const filtered = q ? catalog.filter((name) => name.toLowerCase().includes(q)) : catalog;
  const saltSelected = habitat === "saltwater-offshore" || habitat === "saltwater-inshore";

  function nextHabitatFor(name: string): Habitat {
    const inferred = catalogHabitat(name);
    return inferred && inferred !== "freshwater" ? inferred : habitat;
  }

  function toggle(name: string) {
    const mapped = matchSaltwaterCatalogSpecies(name) ?? name.trim();
    if (!mapped) return;
    const key = mapped.toLowerCase();
    const exists = selected.some((s) => s.toLowerCase() === key);
    if (exists) {
      onChange(
        selected.filter((s) => s.toLowerCase() !== key),
        habitat,
      );
      return;
    }
    if (selected.length <= 1) {
      onChange([mapped], nextHabitatFor(mapped));
      setQuery("");
      return;
    }
    onChange([...selected, mapped], habitat);
  }

  function addTyped() {
    const raw = query.trim();
    if (!raw) return;
    const mapped = matchSaltwaterCatalogSpecies(raw) ?? raw;
    if (isSaltwaterCatalogSpecies(mapped) || !matchLooksFreshwater(raw)) {
      const key = mapped.toLowerCase();
      if (!selected.some((s) => s.toLowerCase() === key)) {
        onChange(selected.length ? [...selected, mapped] : [mapped], nextHabitatFor(mapped));
      }
    }
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
        {hideHints || habitat !== "freshwater" ? null : (
          <p className="on-wash-chip mt-1.5 text-xs">
            This older trip is not inshore or offshore yet. Pick one to recategorize, or leave it.
          </p>
        )}
      </div>

      <div>
        <p className="on-wash-chip mb-1 w-fit text-sm font-semibold">Species in this photo</p>
        {hideHints ? null : (
          <p className="on-wash-chip mb-2 text-xs">
            Tag every fish you can see. Tap chips to add or remove — more than one is fine.
          </p>
        )}
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
        ) : hideHints ? null : (
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

      <div
        data-testid="species-option-chips"
        className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-2xl border border-line bg-paper p-2"
      >
        {filtered.length === 0 ? (
          hideHints ? null : (
            <p className="px-1 py-2 text-xs text-ink-muted">
              No catalog match — type the name and tap Add. Habitat stays{" "}
              {HABITAT_LABELS[listHabitat].toLowerCase()}.
            </p>
          )
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
      {hideHints ? null : (
        <p className="on-wash-chip text-xs">
          Inshore or offshore first so the list stays short. One picture can hold more than one
          species.
        </p>
      )}
    </div>
  );
}

function matchLooksFreshwater(raw: string): boolean {
  const habitat = catalogHabitat(raw);
  return habitat === "freshwater";
}
