"use client";

import { HABITAT_LABELS } from "@/lib/habitat";
import { CONDITION_LABELS } from "@/lib/labels";
import { MOON_PHASES } from "@/lib/moon";
import { PRESSURE_TRENDS, pressureTrendLabel } from "@/lib/pressure";
import { TIME_OF_DAY_LABELS } from "@/lib/time";
import { TIME_OF_DAY, WEATHER_CONDITIONS } from "@/lib/types";
import { WIND_CARDINALS } from "@/lib/wind";
import type { CatchFilters, TimeOfDay, WeatherCondition } from "@/lib/types";

export function FilterPanel({
  filters,
  onChange,
  onClear,
}: {
  filters: CatchFilters;
  onChange: (next: CatchFilters) => void;
  onClear: () => void;
}) {
  function toggle<T extends string>(
    key: "timesOfDay" | "conditions" | "moonPhases" | "pressureTrends" | "windDirections",
    value: T,
  ) {
    const current = (filters[key] ?? []) as T[];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [key]: next });
  }

  return (
    <div className="journal-card space-y-4 rounded-2xl p-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Find similar conditions</p>
        <button type="button" className="text-sm text-teal" onClick={onClear}>
          Clear
        </button>
      </div>
      <HabitatFilters filters={filters} onChange={onChange} />
      <input
        value={filters.species ?? ""}
        onChange={(e) => onChange({ ...filters, species: e.target.value })}
        placeholder="Species (matches any tagged fish)"
        className="w-full rounded-xl border border-line bg-paper px-3 py-2"
      />
      <input
        value={filters.place ?? ""}
        onChange={(e) => onChange({ ...filters, place: e.target.value })}
        placeholder="Place / water"
        className="w-full rounded-xl border border-line bg-paper px-3 py-2"
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-ink-muted">
          From
          <input
            type="date"
            value={filters.from ?? ""}
            onChange={(e) => onChange({ ...filters, from: e.target.value })}
            className="mt-1 w-full rounded-xl border border-line bg-paper px-2 py-2 text-sm text-ink"
          />
        </label>
        <label className="text-xs text-ink-muted">
          To
          <input
            type="date"
            value={filters.to ?? ""}
            onChange={(e) => onChange({ ...filters, to: e.target.value })}
            className="mt-1 w-full rounded-xl border border-line bg-paper px-2 py-2 text-sm text-ink"
          />
        </label>
      </div>
      <ChipRow
        label="Time of day"
        options={TIME_OF_DAY.map((s) => ({ value: s, label: TIME_OF_DAY_LABELS[s] }))}
        selected={filters.timesOfDay ?? []}
        onToggle={(v) => toggle("timesOfDay", v as TimeOfDay)}
      />
      <ChipRow
        label="Sky"
        options={WEATHER_CONDITIONS.map((s) => ({ value: s, label: CONDITION_LABELS[s] }))}
        selected={filters.conditions ?? []}
        onToggle={(v) => toggle("conditions", v as WeatherCondition)}
      />
      <ChipRow
        label="Moon"
        options={MOON_PHASES.map((s) => ({ value: s, label: s }))}
        selected={filters.moonPhases ?? []}
        onToggle={(v) => toggle("moonPhases", v)}
      />
      <ChipRow
        label="Wind dir"
        options={WIND_CARDINALS.map((s) => ({ value: s, label: s }))}
        selected={filters.windDirections ?? []}
        onToggle={(v) => toggle("windDirections", v)}
      />
      <ChipRow
        label="Pressure trend"
        options={PRESSURE_TRENDS.map((s) => ({ value: s, label: pressureTrendLabel(s) }))}
        selected={filters.pressureTrends ?? []}
        onToggle={(v) => toggle("pressureTrends", v)}
      />
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Temp min °F"
          value={filters.tempMin}
          onChange={(n) => onChange({ ...filters, tempMin: n })}
        />
        <NumberField
          label="Temp max °F"
          value={filters.tempMax}
          onChange={(n) => onChange({ ...filters, tempMax: n })}
        />
        <NumberField
          label="Wind min"
          value={filters.windMin}
          onChange={(n) => onChange({ ...filters, windMin: n })}
        />
        <NumberField
          label="Wind max"
          value={filters.windMax}
          onChange={(n) => onChange({ ...filters, windMax: n })}
        />
      </div>
    </div>
  );
}

function ChipRow({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-ink-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const on = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                on ? "bg-teal text-white" : "bg-paper-deep text-ink"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HabitatFilters({
  filters,
  onChange,
}: {
  filters: CatchFilters;
  onChange: (next: CatchFilters) => void;
}) {
  const selected = (filters.habitats ?? []).filter(
    (h): h is "saltwater-inshore" | "saltwater-offshore" =>
      h === "saltwater-inshore" || h === "saltwater-offshore",
  );

  function toggleSaltKind(kind: "saltwater-inshore" | "saltwater-offshore") {
    const on = selected.includes(kind);
    const next = on ? selected.filter((h) => h !== kind) : [...selected, kind];
    onChange({ ...filters, habitats: next.length ? next : undefined });
  }

  return (
    <ChipRow
      label="Water"
      options={[
        { value: "saltwater-inshore", label: HABITAT_LABELS["saltwater-inshore"] },
        { value: "saltwater-offshore", label: HABITAT_LABELS["saltwater-offshore"] },
      ]}
      selected={selected}
      onToggle={(v) => toggleSaltKind(v as "saltwater-inshore" | "saltwater-offshore")}
    />
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (n: number | undefined) => void;
}) {
  return (
    <label className="text-xs text-ink-muted">
      {label}
      <input
        inputMode="decimal"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (!raw) onChange(undefined);
          else {
            const n = Number(raw);
            onChange(Number.isFinite(n) ? n : undefined);
          }
        }}
        className="mt-1 w-full rounded-xl border border-line bg-paper px-2 py-2 text-sm text-ink"
      />
    </label>
  );
}
