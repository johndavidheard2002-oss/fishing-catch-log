"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import exifr from "exifr";
import { PhotoCapture } from "./PhotoCapture";
import { COMMON_SPECIES, CONDITION_LABELS } from "@/lib/labels";
import { compressImage, photoSrc } from "@/lib/photo";
import { datetimeLocalValue, seasonFromDate, TIME_OF_DAY_LABELS, timeOfDayFromDate, SEASON_LABELS } from "@/lib/time";
import { SEASONS, TIME_OF_DAY, WEATHER_CONDITIONS } from "@/lib/types";
import type {
  CatchRecord,
  Season,
  SpeciesSuggestion,
  TimeOfDay,
  WeatherCondition,
} from "@/lib/types";

type FormState = {
  species: string;
  speciesSuggested: string;
  speciesConfidence: number | null;
  speciesSource: CatchRecord["speciesSource"];
  latitude: string;
  longitude: string;
  placeName: string;
  temperatureF: string;
  weatherCondition: string;
  windSpeedMph: string;
  precipitationIn: string;
  humidity: string;
  caughtAt: string;
  timeOfDay: TimeOfDay;
  season: Season;
  notes: string;
  bait: string;
  tide: string;
  waterClarity: string;
};

const emptyForm = (): FormState => {
  const now = new Date();
  return {
    species: "",
    speciesSuggested: "",
    speciesConfidence: null,
    speciesSource: "manual",
    latitude: "",
    longitude: "",
    placeName: "",
    temperatureF: "",
    weatherCondition: "",
    windSpeedMph: "",
    precipitationIn: "",
    humidity: "",
    caughtAt: datetimeLocalValue(now.toISOString()),
    timeOfDay: timeOfDayFromDate(now),
    season: seasonFromDate(now),
    notes: "",
    bait: "",
    tide: "",
    waterClarity: "",
  };
};

function fromRecord(record: CatchRecord): FormState {
  return {
    species: record.species,
    speciesSuggested: record.speciesSuggested ?? "",
    speciesConfidence: record.speciesConfidence,
    speciesSource: record.speciesSource,
    latitude: record.latitude != null ? String(record.latitude) : "",
    longitude: record.longitude != null ? String(record.longitude) : "",
    placeName: record.placeName ?? "",
    temperatureF: record.temperatureF != null ? String(record.temperatureF) : "",
    weatherCondition: record.weatherCondition ?? "",
    windSpeedMph: record.windSpeedMph != null ? String(record.windSpeedMph) : "",
    precipitationIn: record.precipitationIn != null ? String(record.precipitationIn) : "",
    humidity: record.humidity != null ? String(record.humidity) : "",
    caughtAt: datetimeLocalValue(record.caughtAt),
    timeOfDay: record.timeOfDay,
    season: record.season,
    notes: record.notes ?? "",
    bait: record.bait ?? "",
    tide: record.tide ?? "",
    waterClarity: record.waterClarity ?? "",
  };
}

export function CatchForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: CatchRecord;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initial ? fromRecord(initial) : emptyForm());
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initial ? photoSrc(initial.photoPath) : null,
  );
  const [assistNote, setAssistNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(Boolean(initial?.notes || initial?.bait));

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const suggestion = useMemo(() => {
    if (!form.speciesSuggested) return null;
    return {
      species: form.speciesSuggested,
      confidence: form.speciesConfidence,
      source: form.speciesSource,
    };
  }, [form.speciesSuggested, form.speciesConfidence, form.speciesSource]);

  function patch(partial: Partial<FormState>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    const compressed = await compressImage(file);
    const nextFile = new File([compressed], file.name.replace(/\.\w+$/, ".jpg"), {
      type: "image/jpeg",
    });
    setPhotoFile(nextFile);
    const url = URL.createObjectURL(nextFile);
    setPreviewUrl(url);

    let lat: number | undefined;
    let lon: number | undefined;
    let at = new Date();

    try {
      const exif = (await exifr.parse(file, {
        gps: true,
        pick: ["DateTimeOriginal", "CreateDate", "latitude", "longitude"],
      })) as {
        latitude?: number;
        longitude?: number;
        DateTimeOriginal?: Date;
        CreateDate?: Date;
      } | undefined;
      if (exif?.latitude != null && exif.longitude != null) {
        lat = exif.latitude;
        lon = exif.longitude;
      }
      const stamp = exif?.DateTimeOriginal ?? exif?.CreateDate;
      if (stamp instanceof Date && !Number.isNaN(stamp.getTime())) {
        at = stamp;
        patch({
          caughtAt: datetimeLocalValue(stamp.toISOString()),
          timeOfDay: timeOfDayFromDate(stamp),
          season: seasonFromDate(stamp),
        });
      }
    } catch {
      /* EXIF is optional */
    }

    if (lat == null || lon == null) {
      const geo = await getPosition();
      if (geo) {
        lat = geo.coords.latitude;
        lon = geo.coords.longitude;
      }
    }

    if (lat != null && lon != null) {
      patch({ latitude: lat.toFixed(5), longitude: lon.toFixed(5) });
    }

    const notes: string[] = [];
    const tasks: Promise<void>[] = [];

    tasks.push(
      (async () => {
        const fd = new FormData();
        fd.set("photo", nextFile);
        try {
          const res = await fetch("/api/assist/vision", { method: "POST", body: fd });
          const data = (await res.json()) as { suggestion?: SpeciesSuggestion; error?: string };
          if (data.suggestion) {
            setForm((f) => ({
              ...f,
              species: f.species.trim() ? f.species : data.suggestion!.species,
              speciesSuggested: data.suggestion!.species,
              speciesConfidence: data.suggestion!.confidence,
              speciesSource: data.suggestion!.source === "openai" ? "vision" : "demo",
            }));
            notes.push(data.suggestion.note);
          }
        } catch {
          notes.push("Species assist unavailable. Type the species yourself.");
        }
      })(),
    );

    if (lat != null && lon != null) {
      tasks.push(
        (async () => {
          try {
            const res = await fetch("/api/assist/weather", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ latitude: lat, longitude: lon, at: at.toISOString() }),
            });
            const data = await res.json();
            const w = data.weather;
            if (w) {
              patch({
                temperatureF: w.temperatureF != null ? String(w.temperatureF) : "",
                weatherCondition: w.weatherCondition ?? "",
                windSpeedMph: w.windSpeedMph != null ? String(w.windSpeedMph) : "",
                precipitationIn: w.precipitationIn != null ? String(w.precipitationIn) : "",
                humidity: w.humidity != null ? String(w.humidity) : "",
              });
              notes.push(w.note);
            }
          } catch {
            notes.push("Weather lookup failed. Fill it in if you remember.");
          }
        })(),
      );
      tasks.push(
        (async () => {
          try {
            const res = await fetch("/api/assist/place", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ latitude: lat, longitude: lon }),
            });
            const data = await res.json();
            if (data.place?.placeName) {
              patch({ placeName: data.place.placeName });
              notes.push(data.place.note);
            }
          } catch {
            notes.push("Place name lookup failed. You can name the spot.");
          }
        })(),
      );
    } else {
      notes.push("No GPS yet — add a place name if you know it.");
    }

    await Promise.all(tasks);
    setAssistNote(notes.join(" "));
    setBusy(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        species: form.species || form.speciesSuggested || "Unknown",
        speciesSuggested: form.speciesSuggested || null,
        speciesConfidence: form.speciesConfidence,
        speciesSource:
          form.species && form.speciesSuggested && form.species !== form.speciesSuggested
            ? "edited"
            : form.speciesSource,
        latitude: numOrNull(form.latitude),
        longitude: numOrNull(form.longitude),
        placeName: form.placeName || null,
        temperatureF: numOrNull(form.temperatureF),
        weatherCondition: form.weatherCondition || null,
        windSpeedMph: numOrNull(form.windSpeedMph),
        precipitationIn: numOrNull(form.precipitationIn),
        humidity: numOrNull(form.humidity),
        caughtAt: new Date(form.caughtAt).toISOString(),
        timeOfDay: form.timeOfDay,
        season: form.season,
        notes: form.notes || null,
        bait: form.bait || null,
        tide: form.tide || null,
        waterClarity: form.waterClarity || null,
      };

      const url = mode === "edit" && initial ? `/api/catches/${initial.id}` : "/api/catches";
      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      router.push(`/catch/${data.catch.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <PhotoCapture previewUrl={previewUrl} onFile={handleFile} busy={busy} />

      {assistNote ? (
        <p className="rounded-2xl border border-line bg-card px-3 py-2 text-sm text-ink-muted">
          {assistNote}
        </p>
      ) : null}

      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Species</span>
        <input
          list="species-list"
          value={form.species}
          onChange={(e) => patch({ species: e.target.value, speciesSource: form.speciesSuggested ? "edited" : "manual" })}
          placeholder="Type or accept the assist"
          className="w-full rounded-xl border border-line bg-card px-3 py-3"
          required
        />
        <datalist id="species-list">
          {COMMON_SPECIES.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>

      {suggestion?.species ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-paper-deep px-3 py-1 text-ink-muted">
            Assist: {suggestion.species}
            {suggestion.confidence != null
              ? ` · ${Math.round(suggestion.confidence * 100)}%`
              : ""}
          </span>
          <button
            type="button"
            className="font-semibold text-teal"
            onClick={() =>
              patch({
                species: suggestion.species,
                speciesSource: form.speciesSource === "demo" ? "demo" : "vision",
              })
            }
          >
            Use suggestion
          </button>
          <p className="w-full text-xs text-ink-muted">
            Species ID is an assist, not a guarantee. Edit anytime.
          </p>
        </div>
      ) : (
        <p className="text-xs text-ink-muted">
          Species ID is an assist, not a guarantee. Edit anytime.
        </p>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Place</span>
        <input
          value={form.placeName}
          onChange={(e) => patch({ placeName: e.target.value })}
          placeholder="Lake, ramp, or hole name"
          className="w-full rounded-xl border border-line bg-card px-3 py-3"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Lat</span>
          <input
            inputMode="decimal"
            value={form.latitude}
            onChange={(e) => patch({ latitude: e.target.value })}
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Long</span>
          <input
            inputMode="decimal"
            value={form.longitude}
            onChange={(e) => patch({ longitude: e.target.value })}
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Temp °F</span>
          <input
            inputMode="decimal"
            value={form.temperatureF}
            onChange={(e) => patch({ temperatureF: e.target.value })}
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Sky</span>
          <select
            value={form.weatherCondition}
            onChange={(e) => patch({ weatherCondition: e.target.value })}
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          >
            <option value="">Unknown</option>
            {WEATHER_CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {CONDITION_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Wind mph</span>
          <input
            inputMode="decimal"
            value={form.windSpeedMph}
            onChange={(e) => patch({ windSpeedMph: e.target.value })}
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Precip in</span>
          <input
            inputMode="decimal"
            value={form.precipitationIn}
            onChange={(e) => patch({ precipitationIn: e.target.value })}
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold">When</span>
        <input
          type="datetime-local"
          value={form.caughtAt}
          onChange={(e) => {
            const value = e.target.value;
            const d = new Date(value);
            patch({
              caughtAt: value,
              timeOfDay: Number.isNaN(d.getTime()) ? form.timeOfDay : timeOfDayFromDate(d),
              season: Number.isNaN(d.getTime()) ? form.season : seasonFromDate(d),
            });
          }}
          className="w-full rounded-xl border border-line bg-card px-3 py-3"
          required
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Time of day</span>
          <select
            value={form.timeOfDay}
            onChange={(e) => patch({ timeOfDay: e.target.value as TimeOfDay })}
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          >
            {TIME_OF_DAY.map((t) => (
              <option key={t} value={t}>
                {TIME_OF_DAY_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Season</span>
          <select
            value={form.season}
            onChange={(e) => patch({ season: e.target.value as Season })}
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          >
            {SEASONS.map((s) => (
              <option key={s} value={s}>
                {SEASON_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        className="text-left text-sm font-semibold text-teal"
        onClick={() => setShowMore((v) => !v)}
      >
        {showMore ? "Hide bait, tide, notes" : "Bait, tide, water, notes"}
      </button>

      {showMore ? (
        <div className="grid gap-3">
          <input
            value={form.bait}
            onChange={(e) => patch({ bait: e.target.value })}
            placeholder="Bait / lure / fly"
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              value={form.tide}
              onChange={(e) => patch({ tide: e.target.value })}
              placeholder="Tide"
              className="w-full rounded-xl border border-line bg-card px-3 py-3"
            />
            <input
              value={form.waterClarity}
              onChange={(e) => patch({ waterClarity: e.target.value })}
              placeholder="Water clarity"
              className="w-full rounded-xl border border-line bg-card px-3 py-3"
            />
          </div>
          <textarea
            value={form.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="What worked, what didn't"
            rows={3}
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          />
        </div>
      ) : null}

      {error ? <p className="text-sm text-copper">{error}</p> : null}

      <button
        type="submit"
        disabled={saving || busy}
        className="rounded-2xl bg-copper px-4 py-4 text-lg font-semibold text-white disabled:opacity-60"
      >
        {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Save catch"}
      </button>
    </form>
  );
}

function numOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getPosition(): Promise<GeolocationPosition | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  });
}
