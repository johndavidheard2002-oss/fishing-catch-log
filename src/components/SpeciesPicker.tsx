"use client";

import { useState } from "react";
import {
  DEFAULT_HABITAT,
  HABITAT_LABELS,
  catalogHabitat,
  duckSpecies,
  isDuckCatalogSpecies,
  isSaltwaterCatalogSpecies,
  isSharkCatalogSpecies,
  sharkSpecies,
  speciesForHabitat,
  type Habitat,
} from "@/lib/habitat";
import {
  matchCatalogSpecies,
  matchDuckCatalogSpecies,
  matchSaltwaterCatalogSpecies,
  normalizeSpeciesList,
} from "@/lib/species";

type PickerGroup = "saltwater-inshore" | "saltwater-offshore" | "shark" | "duck";

const PICKER_GROUPS: { id: PickerGroup; label: string }[] = [
  { id: "saltwater-inshore", label: HABITAT_LABELS["saltwater-inshore"] },
  { id: "saltwater-offshore", label: HABITAT_LABELS["saltwater-offshore"] },
  { id: "shark", label: "Shark" },
  { id: "duck", label: HABITAT_LABELS.duck },
];

function initialGroup(habitat: Habitat): PickerGroup {
  if (habitat === "duck") return "duck";
  return habitat === "saltwater-offshore" ? "saltwater-offshore" : "saltwater-inshore";
}

function mapPickerSpecies(raw: string): string {
  return (
    matchSaltwaterCatalogSpecies(raw) ??
    matchDuckCatalogSpecies(raw) ??
    matchCatalogSpecies(raw) ??
    raw.trim()
  );
}

function groupCatalog(group: PickerGroup): string[] {
  if (group === "shark") return sharkSpecies();
  if (group === "duck") return duckSpecies();
  return speciesForHabitat(group);
}

function searchPlaceholder(group: PickerGroup): string {
  if (group === "shark") return "Search sharks or type a name";
  if (group === "duck") return "Search ducks or type a name";
  return `Search ${HABITAT_LABELS[group].toLowerCase()} or type a name`;
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
  const selected = normalizeSpeciesList(null, speciesList).filter(
    (name) => name.toLowerCase() !== "unknown",
  );
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<PickerGroup>(() => initialGroup(habitat));
  const catalog = groupCatalog(group);
  const q = query.trim().toLowerCase();
  const filtered = q ? catalog.filter((name) => name.toLowerCase().includes(q)) : catalog;

  function nextHabitatFor(name: string): Habitat {
    if (isDuckCatalogSpecies(name)) return "duck";
    if (isSharkCatalogSpecies(name) || /shark/i.test(name)) {
      return habitat === "duck" ? DEFAULT_HABITAT : habitat;
    }
    const inferred = catalogHabitat(name);
    if (inferred && inferred !== "freshwater") return inferred;
    if (group === "duck") return "duck";
    return habitat === "duck" ? DEFAULT_HABITAT : habitat;
  }

  function toggle(name: string) {
    const mapped = mapPickerSpecies(name);
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
    const mapped = mapPickerSpecies(raw);
    if (isSaltwaterCatalogSpecies(mapped) || isDuckCatalogSpecies(mapped) || !matchLooksFreshwater(raw)) {
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

  function pickGroup(id: PickerGroup) {
    setGroup(id);
    if (id === "shark") return;
    onHabitat(id);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="on-wash-chip mb-1.5 w-fit text-sm font-semibold">Category</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PICKER_GROUPS.map((option) => {
            const on = group === option.id;
            return (
              <button
                key={option.id}
                type="button"
                data-testid={`species-group-${option.id}`}
                onClick={() => pickGroup(option.id)}
                className={`rounded-xl px-2 py-2.5 text-sm font-semibold ${
                  on ? "bg-teal text-white" : "border border-line bg-card"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {hideHints || habitat !== "freshwater" ? null : (
          <p className="on-wash-chip mt-1.5 text-xs">
            This older trip is not inshore or offshore yet. Pick one to recategorize, or leave it.
          </p>
        )}
      </div>

      <div>
        <p className="on-wash-chip mb-1 w-fit text-sm font-semibold">Species</p>
        {hideHints ? null : (
          <p className="on-wash-chip mb-2 text-xs">
            Optional — tap chips or type a name. You can save now and add the species later.
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
        ) : null}
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
            placeholder={searchPlaceholder(group)}
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          />
          <button
            type="button"
            onClick={addTyped}
            className="shrink-0 rounded-xl border border-line px-3 text-sm font-semibold text-teal"
          >
            Add other
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
              No catalog match — type the name and tap Add other.
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
          Inshore, offshore, shark, or duck so the list stays short. One picture can hold more than
          one species.
        </p>
      )}
    </div>
  );
}

function matchLooksFreshwater(raw: string): boolean {
  const habitat = catalogHabitat(raw);
  return habitat === "freshwater";
}
