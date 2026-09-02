"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AreaNamePicker } from "./AreaNamePicker";
import { MapPicker } from "./MapPicker";
import { PhotoCapture } from "./PhotoCapture";
import { BAIT_CATALOG } from "@/lib/bait";
import { DEFAULT_HABITAT, HABITAT_LABELS, type Habitat } from "@/lib/habitat";
import { formatTideDetail, tidesApplyToHabitat } from "@/lib/tides/snapshot";
import { inHgToMb, mbToInHg } from "@/lib/pressure";
import { PRIVACY_LINE } from "@/lib/privacy";
import { photoSrc } from "@/lib/photo";
import { dateFromDatetimeLocal, datetimeLocalValue, isoFromDatetimeLocal, seasonFromCaughtAtInput, seasonFromDate, timeOfDayFromCaughtAtInput, timeOfDayFromDate } from "@/lib/time";
import type { BaitSpot, NamedArea, Season, TimeOfDay } from "@/lib/types";

type FormState = {
  placeName: string;
  latitude: string;
  longitude: string;
  baitTypes: string[];
  loggedAt: string;
  timeOfDay: TimeOfDay;
  season: Season;
  notes: string;
  habitat: Habitat;
  temperatureF: string;
  weatherCondition: string;
  windSpeedMph: string;
  windDirection: string;
  precipitationIn: string;
  humidity: string;
  moonPhase: string;
  moonIllumination: string;
  pressureInHg: string;
  pressureMb: string;
  pressureTrend: string;
  tide: string;
  tideHeightFt: string;
  tideDetail: string;
  sharedWithLinked: boolean;
};

function emptyForm(): FormState {
  const now = new Date();
  const loggedAt = datetimeLocalValue(now.toISOString());
  return {
    placeName: "",
    latitude: "",
    longitude: "",
    baitTypes: [],
    loggedAt,
    timeOfDay: timeOfDayFromDate(now),
    season: seasonFromDate(now),
    notes: "",
    habitat: DEFAULT_HABITAT,
    temperatureF: "",
    weatherCondition: "",
    windSpeedMph: "",
    windDirection: "",
    precipitationIn: "",
    humidity: "",
    moonPhase: "",
    moonIllumination: "",
    pressureInHg: "",
    pressureMb: "",
    pressureTrend: "",
    tide: "",
    tideHeightFt: "",
    tideDetail: "",
    sharedWithLinked: false,
  };
}

function fromRecord(record: BaitSpot): FormState {
  return {
    placeName: record.placeName ?? "",
    latitude: record.latitude != null ? String(record.latitude) : "",
    longitude: record.longitude != null ? String(record.longitude) : "",
    baitTypes: record.baitTypes,
    loggedAt: datetimeLocalValue(record.loggedAt),
    timeOfDay: record.timeOfDay,
    season: record.season,
    notes: record.notes ?? "",
    habitat: record.habitat === "freshwater" ? DEFAULT_HABITAT : record.habitat,
    temperatureF: record.temperatureF != null ? String(record.temperatureF) : "",
    weatherCondition: record.weatherCondition ?? "",
    windSpeedMph: record.windSpeedMph != null ? String(record.windSpeedMph) : "",
    windDirection: record.windDirection ?? "",
    precipitationIn: record.precipitationIn != null ? String(record.precipitationIn) : "",
    humidity: record.humidity != null ? String(record.humidity) : "",
    moonPhase: record.moonPhase ?? "",
    moonIllumination: record.moonIllumination != null ? String(record.moonIllumination) : "",
    pressureInHg: record.pressureInHg != null ? String(record.pressureInHg) : "",
    pressureMb: record.pressureMb != null ? String(record.pressureMb) : "",
    pressureTrend: record.pressureTrend ?? "",
    tide: record.tide ?? "",
    tideHeightFt: record.tideHeightFt != null ? String(record.tideHeightFt) : "",
    tideDetail: record.tideDetail ?? "",
    sharedWithLinked: record.sharedWithLinked,
  };
}

const SALT_OPTIONS: Habitat[] = ["saltwater-inshore", "saltwater-offshore"];

export function BaitSpotForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: BaitSpot;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => (initial ? fromRecord(initial) : emptyForm()));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initial ? photoSrc(initial.photoPath) : null,
  );
  const [customBait, setCustomBait] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [assistNote, setAssistNote] = useState<string | null>(null);
  const [buddyNames, setBuddyNames] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/buddies")
      .then((r) => r.json())
      .then((data) => setBuddyNames(((data.buddies ?? []) as { name: string }[]).map((b) => b.name)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function patch(partial: Partial<FormState>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  useEffect(() => {
    const lat = numOrNull(form.latitude);
    const lon = numOrNull(form.longitude);
    const at = dateFromDatetimeLocal(form.loggedAt) ?? new Date(form.loggedAt);
    if (lat == null || lon == null || Number.isNaN(at.getTime())) return;
    let cancelled = false;
    fetch("/api/assist/weather", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: lat,
        longitude: lon,
        at: at.toISOString(),
        habitat: form.habitat,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.weather && !data.tide) return;
        setForm((f) => ({
          ...f,
          ...weatherFields(data.weather),
          ...tideFields(data.tide, form.habitat),
        }));
        const notes = [data.weather?.note, data.tide?.note].filter(Boolean);
        if (notes.length) setAssistNote(notes.join(" "));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [form.latitude, form.longitude, form.loggedAt, form.habitat]);

  function toggleBait(name: string) {
    const key = name.trim().toLowerCase();
    if (!key) return;
    patch({
      baitTypes: form.baitTypes.some((b) => b.toLowerCase() === key)
        ? form.baitTypes.filter((b) => b.toLowerCase() !== key)
        : [...form.baitTypes, name.trim()],
    });
  }

  function onPickArea(area: NamedArea) {
    patch({ placeName: area.name });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (savingRef.current) return;
    if (!form.baitTypes.length) {
      setError("Add at least one bait type.");
      return;
    }
    if (numOrNull(form.latitude) == null || numOrNull(form.longitude) == null) {
      setError("Tap the map to pin this bait hole.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      let photoPath = initial?.photoPath ?? null;
      if (photoFile) {
        const fd = new FormData();
        fd.set("photo", photoFile);
        const up = await fetch("/api/media", { method: "POST", body: fd });
        const data = await up.json();
        if (!up.ok) throw new Error(data.error || "Photo upload failed");
        photoPath = data.photoPath;
      }
      const payload = {
        photoPath,
        placeName: form.placeName || null,
        baitTypes: form.baitTypes,
        latitude: numOrNull(form.latitude),
        longitude: numOrNull(form.longitude),
        loggedAt: isoFromDatetimeLocal(form.loggedAt),
        timeOfDay: form.timeOfDay,
        season: form.season,
        notes: form.notes || null,
        habitat: form.habitat,
        temperatureF: numOrNull(form.temperatureF),
        weatherCondition: form.weatherCondition || null,
        windSpeedMph: numOrNull(form.windSpeedMph),
        windDirection: form.windDirection || null,
        precipitationIn: numOrNull(form.precipitationIn),
        humidity: numOrNull(form.humidity),
        moonPhase: form.moonPhase || null,
        moonIllumination: numOrNull(form.moonIllumination),
        pressureInHg: numOrNull(form.pressureInHg),
        pressureMb: numOrNull(form.pressureMb),
        pressureTrend: form.pressureTrend || null,
        tide: form.tide || null,
        tideHeightFt: numOrNull(form.tideHeightFt),
        tideDetail: form.tideDetail || null,
        sharedWithLinked: form.sharedWithLinked,
      };
      const url = mode === "edit" && initial ? `/api/bait-spots/${initial.id}` : "/api/bait-spots";
      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      router.push("/spots?kind=bait");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const catchLat = numOrNull(form.latitude);
  const catchLon = numOrNull(form.longitude);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <PhotoCapture
        previewUrl={previewUrl}
        onFile={(file) => {
          setPhotoFile(file);
          setPreviewUrl(URL.createObjectURL(file));
        }}
        emptyTitle="Photo of the bait (optional)"
        emptyHint="Not required. Pin the hole and tag what you scooped."
      />
      {assistNote ? (
        <p className="rounded-2xl border border-line bg-card px-3 py-2 text-sm text-ink-muted">
          {assistNote}
        </p>
      ) : null}

      <AreaNamePicker
        value={form.placeName}
        latitude={catchLat}
        longitude={catchLon}
        onChange={(placeName) => patch({ placeName })}
        onPickArea={onPickArea}
      />
      {catchLat == null ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper px-3 py-2 text-xs">
          Tap the satellite map to pin where you got bait.
        </div>
      ) : null}
      <MapPicker
        latitude={catchLat}
        longitude={catchLon}
        onChange={(lat, lng) => {
          patch({ latitude: lat.toFixed(5), longitude: lng.toFixed(5) });
          if (form.placeName.trim()) return;
          fetch("/api/assist/place", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude: lat, longitude: lng }),
          })
            .then((r) => r.json())
            .then((data) => {
              const autoPlace = data.place?.placeName as string | undefined;
              if (!autoPlace) return;
              setForm((f) => (f.placeName.trim() ? f : { ...f, placeName: autoPlace }));
            })
            .catch(() => {});
        }}
      />

      <div>
        <p className="on-wash-chip mb-1.5 w-fit text-sm font-semibold">Bait type</p>
        <div className="flex flex-wrap gap-1.5">
          {BAIT_CATALOG.map((name) => {
            const selected = form.baitTypes.some((b) => b.toLowerCase() === name.toLowerCase());
            return (
              <button
                key={name}
                type="button"
                data-testid={`bait-type-${name.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => toggleBait(name)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  selected ? "bg-copper text-white" : "border border-line bg-card"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={customBait}
            onChange={(e) => setCustomBait(e.target.value)}
            placeholder="Other bait"
            className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              toggleBait(customBait);
              setCustomBait("");
            }}
            className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold"
          >
            Add
          </button>
        </div>
      </div>

      <div>
        <p className="on-wash-chip mb-1.5 w-fit text-sm font-semibold">Water</p>
        <div className="grid grid-cols-2 gap-2">
          {SALT_OPTIONS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => patch({ habitat: id })}
              className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${
                form.habitat === id ? "bg-teal text-white" : "border border-line bg-card"
              }`}
            >
              {HABITAT_LABELS[id]}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="on-wash-chip mb-1 inline-block text-sm font-semibold">When</span>
        <input
          type="datetime-local"
          value={form.loggedAt}
          onChange={(e) => {
            const next = e.target.value;
            const d = dateFromDatetimeLocal(next) ?? new Date(next);
            patch({
              loggedAt: next,
              timeOfDay: timeOfDayFromCaughtAtInput(next) ?? timeOfDayFromDate(d),
              season: seasonFromCaughtAtInput(next) ?? seasonFromDate(d),
            });
          }}
          className="w-full rounded-xl border border-line bg-card px-3 py-3"
          required
        />
      </label>

      <label className="block">
        <span className="on-wash-chip mb-1 inline-block text-sm font-semibold">Notes</span>
        <textarea
          value={form.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="Throw net, incoming, parked by the bridge…"
          rows={3}
          className="w-full rounded-xl border border-line bg-card px-3 py-3"
        />
      </label>

      <label className="flex items-start gap-2 rounded-2xl border border-line bg-card px-3 py-3 text-sm">
        <input
          type="checkbox"
          checked={form.sharedWithLinked}
          onChange={(e) => patch({ sharedWithLinked: e.target.checked })}
          className="mt-1"
        />
        <span>
          <span className="font-semibold">Share with linked buddies</span>
          <span className="mt-0.5 block text-xs text-ink-muted">
            Off by default. {PRIVACY_LINE}
            {buddyNames.length
              ? ` This bait spot would go to: ${buddyNames.join(", ")}.`
              : " You have no linked buddies yet, so nobody else can see this."}
          </span>
        </span>
      </label>

      {error ? <p className="text-sm text-copper">{error}</p> : null}
      <button
        type="submit"
        disabled={saving}
        data-testid="save-bait-spot"
        className="rounded-2xl bg-copper px-4 py-3 text-lg font-semibold text-white disabled:opacity-60"
      >
        {saving ? "Saving…" : mode === "edit" ? "Save bait" : "Log bait"}
      </button>
    </form>
  );
}

function numOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function weatherFields(w: {
  temperatureF?: number | null;
  weatherCondition?: string | null;
  windSpeedMph?: number | null;
  windDirection?: string | null;
  precipitationIn?: number | null;
  humidity?: number | null;
  moonPhase?: string | null;
  moonIllumination?: number | null;
  pressureInHg?: number | null;
  pressureMb?: number | null;
  pressureTrend?: string | null;
} | null): Partial<FormState> {
  if (!w) return {};
  const inHg =
    w.pressureInHg != null ? w.pressureInHg : w.pressureMb != null ? mbToInHg(w.pressureMb) : null;
  const mb =
    w.pressureMb != null ? w.pressureMb : w.pressureInHg != null ? inHgToMb(w.pressureInHg) : null;
  return {
    ...(w.temperatureF != null ? { temperatureF: String(w.temperatureF) } : {}),
    ...(w.weatherCondition ? { weatherCondition: w.weatherCondition } : {}),
    ...(w.windSpeedMph != null ? { windSpeedMph: String(w.windSpeedMph) } : {}),
    ...(w.windDirection ? { windDirection: w.windDirection } : {}),
    ...(w.precipitationIn != null ? { precipitationIn: String(w.precipitationIn) } : {}),
    ...(w.humidity != null ? { humidity: String(w.humidity) } : {}),
    ...(w.moonPhase ? { moonPhase: w.moonPhase } : {}),
    ...(w.moonIllumination != null ? { moonIllumination: String(w.moonIllumination) } : {}),
    ...(inHg != null ? { pressureInHg: String(inHg) } : {}),
    ...(mb != null ? { pressureMb: String(mb) } : {}),
    ...(w.pressureTrend ? { pressureTrend: w.pressureTrend } : {}),
  };
}

function tideFields(
  t:
    | {
        applies?: boolean;
        tide?: string | null;
        heightFt?: number | null;
        nextHighAt?: string | null;
        nextHighFt?: number | null;
        nextLowAt?: string | null;
        nextLowFt?: number | null;
      }
    | null
    | undefined,
  habitat: Habitat,
): Partial<FormState> {
  if (!t || !tidesApplyToHabitat(habitat)) return {};
  if (t.applies === false) return { tide: "", tideHeightFt: "", tideDetail: "" };
  const detail = formatTideDetail(t);
  return {
    ...(t.tide ? { tide: t.tide } : {}),
    ...(t.heightFt != null ? { tideHeightFt: String(t.heightFt) } : {}),
    ...(detail ? { tideDetail: detail } : {}),
  };
}
