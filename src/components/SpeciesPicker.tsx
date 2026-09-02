"use client";

import {
  HABITAT_LABELS,
  WATER_TYPE_LABELS,
  catalogHabitat,
  speciesForHabitat,
  waterTypeOf,
  type Habitat,
  type WaterType,
} from "@/lib/habitat";

export function SpeciesPicker({
  species,
  habitat,
  onSpecies,
  onHabitat,
}: {
  species: string;
  habitat: Habitat;
  onSpecies: (species: string, habitat: Habitat) => void;
  onHabitat: (habitat: Habitat) => void;
}) {
  const water = waterTypeOf(habitat);
  const list = speciesForHabitat(habitat);
  const q = species.trim().toLowerCase();
  const filtered = q
    ? list.filter((name) => name.toLowerCase().includes(q))
    : list;

  function setWater(next: WaterType) {
    if (next === "freshwater") onHabitat("freshwater");
    else if (water !== "saltwater") onHabitat("saltwater-inshore");
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-sm font-semibold">Water type</p>
        <div className="grid grid-cols-2 gap-2">
          {(["freshwater", "saltwater"] as const).map((id) => (
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

      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Species</span>
        <input
          value={species}
          onChange={(e) => {
            const next = e.target.value;
            onSpecies(next, catalogHabitat(next) ?? habitat);
          }}
          placeholder={`Search ${HABITAT_LABELS[habitat].toLowerCase()} species`}
          className="w-full rounded-xl border border-line bg-card px-3 py-3"
          required
        />
      </label>

      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-2xl border border-line bg-paper p-2">
        {filtered.length === 0 ? (
          <p className="px-1 py-2 text-xs text-ink-muted">
            No catalog match — type the name. Habitat stays {HABITAT_LABELS[habitat].toLowerCase()}.
          </p>
        ) : (
          filtered.map((name) => {
            const on = species === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => onSpecies(name, habitat)}
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
        Pick water type first so the list stays short. You can still type any name or override
        habitat.
      </p>
    </div>
  );
}
