"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import exifr from "exifr";
import { MapPicker } from "./MapPicker";
import { PhotoCapture } from "./PhotoCapture";
import { SpeciesPicker } from "./SpeciesPicker";
import { inferHabitat, isHabitat } from "@/lib/habitat";
import { MOON_PHASES, moonForDate } from "@/lib/moon";
import { inHgToMb, mbToInHg, PRESSURE_TRENDS, pressureTrendLabel } from "@/lib/pressure";
import { PRIVACY_LINE } from "@/lib/privacy";
import { CONDITION_LABELS } from "@/lib/labels";
import { compressImage, photoSrc } from "@/lib/photo";
import { coordsLookDifferent, formatCoords, shouldApplyPhotoGpsToCatch } from "@/lib/location";
import { SPECIES_AUTO_FILL_MIN, normalizeSpeciesList, primarySpecies } from "@/lib/species";
import { localDateKey } from "@/lib/calendar";
import { datetimeLocalValue, seasonFromDate, TIME_OF_DAY_LABELS, timeOfDayFromDate, SEASON_LABELS } from "@/lib/time";
import { SEASONS, TIME_OF_DAY, WEATHER_CONDITIONS } from "@/lib/types";
import { WIND_DIRECTIONS } from "@/lib/wind";
import type {
  CatchRecord,
  Habitat,
  Season,
  SpeciesSuggestion,
  TimeOfDay,
} from "@/lib/types";

type FormState = {
  speciesList: string[];
  speciesSuggested: string;
  speciesConfidence: number | null;
  speciesSource: CatchRecord["speciesSource"];
  latitude: string;
  longitude: string;
  photoTakenLatitude: string;
  photoTakenLongitude: string;
  placeName: string;
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
  caughtAt: string;
  timeOfDay: TimeOfDay;
  season: Season;
  notes: string;
  bait: string;
  tide: string;
  waterClarity: string;
  habitat: Habitat;
  sharedWithLinked: boolean;
  speciesAlternatives: { species: string; confidence: number }[];
  speciesSuggestedList: string[];
};

const emptyForm = (pastMode = false, caughtAtIso?: string | null): FormState => {
  const parsed = caughtAtIso ? new Date(caughtAtIso) : new Date();
  const now = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const moon = moonForDate(now);
  const hasStamp = Boolean(caughtAtIso && !Number.isNaN(parsed.getTime()));
  return {
    speciesList: [],
    speciesSuggested: "",
    speciesConfidence: null,
    speciesSource: "manual",
    latitude: "",
    longitude: "",
    photoTakenLatitude: "",
    photoTakenLongitude: "",
    placeName: "",
    temperatureF: "",
    weatherCondition: "",
    windSpeedMph: "",
    windDirection: "",
    precipitationIn: "",
    humidity: "",
    moonPhase: pastMode && !hasStamp ? "" : moon.phase,
    moonIllumination: pastMode && !hasStamp ? "" : String(moon.illumination),
    pressureInHg: "",
    pressureMb: "",
    pressureTrend: "",
    caughtAt: pastMode && !hasStamp ? "" : datetimeLocalValue(now.toISOString()),
    timeOfDay: timeOfDayFromDate(now),
    season: seasonFromDate(now),
    notes: "",
    bait: "",
    tide: "",
    waterClarity: "",
    habitat: "freshwater",
    sharedWithLinked: false,
    speciesAlternatives: [],
    speciesSuggestedList: [],
  };
};

function fromRecord(record: CatchRecord): FormState {
  return {
    speciesList: record.speciesList?.length
      ? record.speciesList
      : record.species
        ? [record.species]
        : [],
    speciesSuggested: record.speciesSuggested ?? "",
    speciesConfidence: record.speciesConfidence,
    speciesSource: record.speciesSource,
    latitude: record.latitude != null ? String(record.latitude) : "",
    longitude: record.longitude != null ? String(record.longitude) : "",
    photoTakenLatitude: record.photoTakenLatitude != null ? String(record.photoTakenLatitude) : "",
    photoTakenLongitude:
      record.photoTakenLongitude != null ? String(record.photoTakenLongitude) : "",
    placeName: record.placeName ?? "",
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
    caughtAt: datetimeLocalValue(record.caughtAt),
    timeOfDay: record.timeOfDay,
    season: record.season,
    notes: record.notes ?? "",
    bait: record.bait ?? "",
    tide: record.tide ?? "",
    waterClarity: record.waterClarity ?? "",
    habitat: record.habitat,
    sharedWithLinked: record.sharedWithLinked,
    speciesAlternatives: [],
    speciesSuggestedList: [],
  };
}

export function CatchForm({
  mode,
  initial,
  pastMode = false,
  importedPhotoPath = null,
  importedCaughtAt = null,
  importedPhotoLat = null,
  importedPhotoLon = null,
  afterSave = "detail",
}: {
  mode: "create" | "edit";
  initial?: CatchRecord;
  pastMode?: boolean;
  importedPhotoPath?: string | null;
  importedCaughtAt?: string | null;
  importedPhotoLat?: number | null;
  importedPhotoLon?: number | null;
  afterSave?: "detail" | "calendar";
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => {
    const base = initial ? fromRecord(initial) : emptyForm(pastMode, importedCaughtAt);
    if (importedPhotoLat == null || importedPhotoLon == null) return base;
    return {
      ...base,
      photoTakenLatitude: String(importedPhotoLat),
      photoTakenLongitude: String(importedPhotoLon),
    };
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initial
      ? photoSrc(initial.photoPath)
      : importedPhotoPath
        ? photoSrc(importedPhotoPath)
        : null,
  );
  const [assistNote, setAssistNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(Boolean(initial?.notes || initial?.bait));
  const [buddyNames, setBuddyNames] = useState<string[]>([]);
  const [moonLocked, setMoonLocked] = useState(false);
  const [catchLocationLocked, setCatchLocationLocked] = useState(
    Boolean(initial?.latitude && initial?.longitude),
  );

  useEffect(() => {
    fetch("/api/buddies")
      .then((r) => r.json())
      .then((data) => {
        setBuddyNames(((data.buddies ?? []) as { name: string }[]).map((b) => b.name));
      })
      .catch(() => {});
  }, []);

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

  function lockCatchLocation(partial: Partial<FormState>) {
    setCatchLocationLocked(true);
    patch(partial);
  }

  useEffect(() => {
    if (!pastMode) return;
    const lat = numOrNull(form.latitude);
    const lon = numOrNull(form.longitude);
    const at = new Date(form.caughtAt);
    if (lat == null || lon == null || Number.isNaN(at.getTime())) return;
    let cancelled = false;
    fetch("/api/assist/weather", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: lat, longitude: lon, at: at.toISOString() }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.weather) return;
        const w = data.weather;
        setForm((f) => ({
          ...f,
          ...weatherFields(w, { includeMoon: !moonLocked }),
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pastMode, form.caughtAt, form.latitude, form.longitude, moonLocked]);

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
    const formWhen = form.caughtAt ? new Date(form.caughtAt) : null;
    let at =
      formWhen && !Number.isNaN(formWhen.getTime()) ? formWhen : pastMode ? new Date(0) : new Date();

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
          ...moonFields(stamp, moonLocked),
        });
      }
    } catch {
      /* EXIF is optional */
    }

    if (!pastMode && (lat == null || lon == null)) {
      const geo = await getPosition();
      if (geo) {
        lat = geo.coords.latitude;
        lon = geo.coords.longitude;
      }
    }

    const notes: string[] = [];
    const applyToCatch = shouldApplyPhotoGpsToCatch(catchLocationLocked);
    if (lat != null && lon != null) {
      patch({
        photoTakenLatitude: lat.toFixed(5),
        photoTakenLongitude: lon.toFixed(5),
        ...(applyToCatch ? { latitude: lat.toFixed(5), longitude: lon.toFixed(5) } : {}),
      });
      if (!applyToCatch) {
        notes.push("Catch pin left where you set it. Photo GPS is only “photo taken at.”");
      }
    }

    const tasks: Promise<void>[] = [];
    const weatherLat = applyToCatch ? lat : (numOrNull(form.latitude) ?? lat);
    const weatherLon = applyToCatch ? lon : (numOrNull(form.longitude) ?? lon);

    tasks.push(
      (async () => {
        const fd = new FormData();
        fd.set("photo", nextFile);
        if (form.habitat) fd.set("habitat", form.habitat);
        if (lat != null) fd.set("latitude", String(lat));
        if (lon != null) fd.set("longitude", String(lon));
        if (form.placeName) fd.set("placeName", form.placeName);
        try {
          const res = await fetch("/api/assist/vision", { method: "POST", body: fd });
          const data = (await res.json()) as { suggestion?: SpeciesSuggestion; error?: string };
          if (data.suggestion) {
            setForm((f) => {
              const guess = data.suggestion!;
              const suggestedList = normalizeSpeciesList(guess.species, guess.speciesList);
              const autoFill =
                !f.speciesList.length &&
                guess.species !== "Unknown" &&
                guess.confidence >= SPECIES_AUTO_FILL_MIN &&
                suggestedList.length > 0;
              const nextList = autoFill ? suggestedList : f.speciesList;
              const nextHabitat =
                autoFill && guess.habitat && isHabitat(guess.habitat)
                  ? guess.habitat
                  : autoFill
                    ? inferHabitat(primarySpecies(nextList), f.habitat)
                    : f.habitat;
              return {
                ...f,
                speciesList: nextList,
                speciesSuggested: guess.species,
                speciesConfidence: guess.confidence,
                speciesSource: guess.source === "openai" ? "vision" : "demo",
                speciesAlternatives: guess.alternatives ?? [],
                speciesSuggestedList: suggestedList,
                habitat: nextHabitat,
              };
            });
            notes.push(data.suggestion.note);
          }
        } catch {
          notes.push("Species assist unavailable. Type the species yourself.");
        }
      })(),
    );

    if (weatherLat != null && weatherLon != null) {
      if (at.getTime() > 0) {
      tasks.push(
        (async () => {
          try {
            const res = await fetch("/api/assist/weather", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ latitude: weatherLat, longitude: weatherLon, at: at.toISOString() }),
            });
            const data = await res.json();
            const w = data.weather;
            if (w) {
              patch(weatherFields(w, { includeMoon: !moonLocked }));
              notes.push(w.note);
            }
          } catch {
            notes.push("Weather lookup failed. Fill it in if you remember.");
          }
        })(),
      );
      }
      if (applyToCatch) {
      tasks.push(
        (async () => {
          try {
            const res = await fetch("/api/assist/place", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ latitude: weatherLat, longitude: weatherLon }),
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
      }
    } else if (pastMode) {
      notes.push(
        "Pin the exact water on the map and set the date. We did not use your current location.",
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
    if (!form.speciesList.length) {
      setSaving(false);
      setError("Add at least one species. You can tag more than one fish in the same photo.");
      return;
    }
    try {
      let photoPath = initial?.photoPath ?? importedPhotoPath ?? null;
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
        species: primarySpecies(form.speciesList),
        speciesList: form.speciesList,
        speciesSuggested: form.speciesSuggested || null,
        speciesConfidence: form.speciesConfidence,
        speciesSource:
          form.speciesList.length &&
          form.speciesSuggested &&
          !form.speciesList.map((s) => s.toLowerCase()).includes(form.speciesSuggested.toLowerCase())
            ? "edited"
            : form.speciesSource,
        latitude: numOrNull(form.latitude),
        longitude: numOrNull(form.longitude),
        photoTakenLatitude: numOrNull(form.photoTakenLatitude),
        photoTakenLongitude: numOrNull(form.photoTakenLongitude),
        placeName: form.placeName || null,
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
        caughtAt: new Date(form.caughtAt).toISOString(),
        timeOfDay: form.timeOfDay,
        season: form.season,
        notes: form.notes || null,
        bait: form.bait || null,
        tide: form.tide || null,
        waterClarity: form.waterClarity || null,
        habitat: form.habitat,
        sharedWithLinked: form.sharedWithLinked,
      };

      const url = mode === "edit" && initial ? `/api/catches/${initial.id}` : "/api/catches";
      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      if (afterSave === "calendar") {
        router.push(`/history?view=calendar&day=${localDateKey(data.catch.caughtAt)}`);
      } else {
        router.push(`/catch/${data.catch.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <PhotoCapture
        previewUrl={previewUrl}
        onFile={handleFile}
        busy={busy}
        emphasis={pastMode ? "library" : "camera"}
      />

      {assistNote ? (
        <p className="rounded-2xl border border-line bg-card px-3 py-2 text-sm text-ink-muted">
          {assistNote}
        </p>
      ) : null}

      {pastMode ? (
        <>
          <div>
            <p className="mb-1 text-sm font-semibold">When you caught it</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-ink-muted">Date</span>
                <input
                  type="date"
                  value={form.caughtAt.slice(0, 10)}
                  onChange={(e) => {
                    const next = joinDateTime(e.target.value, form.caughtAt.slice(11, 16) || "12:00");
                    const d = new Date(next);
                    patch({
                      caughtAt: next,
                      timeOfDay: Number.isNaN(d.getTime()) ? form.timeOfDay : timeOfDayFromDate(d),
                      season: Number.isNaN(d.getTime()) ? form.season : seasonFromDate(d),
                      ...moonFields(d, moonLocked),
                    });
                  }}
                  className="w-full rounded-xl border border-line bg-card px-3 py-3"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-ink-muted">Time</span>
                <input
                  type="time"
                  value={form.caughtAt.slice(11, 16)}
                  onChange={(e) => {
                    const day = form.caughtAt.slice(0, 10);
                    if (!day) return;
                    const next = joinDateTime(day, e.target.value);
                    const d = new Date(next);
                    patch({
                      caughtAt: next,
                      timeOfDay: Number.isNaN(d.getTime()) ? form.timeOfDay : timeOfDayFromDate(d),
                      season: Number.isNaN(d.getTime()) ? form.season : seasonFromDate(d),
                      ...moonFields(d, moonLocked),
                    });
                  }}
                  className="w-full rounded-xl border border-line bg-card px-3 py-3"
                  required
                />
              </label>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Any past date. The photo&apos;s EXIF time is used when it&apos;s there.
            </p>
          </div>
        </>
      ) : null}

      <SpeciesPicker
        speciesList={form.speciesList}
        habitat={form.habitat}
        onHabitat={(habitat) => patch({ habitat })}
        onChange={(speciesList, habitat) =>
          patch({
            speciesList,
            habitat,
            speciesSource: form.speciesSuggested ? "edited" : "manual",
          })
        }
      />

      {suggestion?.species ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-paper-deep px-3 py-1 text-ink-muted">
              Assist:{" "}
              {(form.speciesSuggestedList.length
                ? form.speciesSuggestedList
                : [suggestion.species]
              ).join(" + ")}
              {suggestion.confidence != null
                ? ` · ${Math.round(suggestion.confidence * 100)}%`
                : ""}
              {form.speciesSource === "demo" ? " · demo" : ""}
            </span>
            {form.speciesSuggestedList.length > 1 ? (
              <button
                type="button"
                className="font-semibold text-teal"
                onClick={() => {
                  const merged = normalizeSpeciesList(null, [
                    ...form.speciesList,
                    ...form.speciesSuggestedList,
                  ]);
                  patch({
                    speciesList: merged,
                    habitat: inferHabitat(primarySpecies(merged), form.habitat),
                    speciesSource: form.speciesSource === "demo" ? "demo" : "vision",
                  });
                }}
              >
                Add all in photo
              </button>
            ) : (
              <button
                type="button"
                className="font-semibold text-teal"
                onClick={() => {
                  const add = normalizeSpeciesList(suggestion.species, form.speciesSuggestedList);
                  const merged = normalizeSpeciesList(null, [...form.speciesList, ...add]);
                  patch({
                    speciesList: merged,
                    habitat: inferHabitat(suggestion.species, form.habitat),
                    speciesSource: form.speciesSource === "demo" ? "demo" : "vision",
                  });
                }}
              >
                Add suggestion
              </button>
            )}
          </div>
          {(suggestion.confidence ?? 1) < SPECIES_AUTO_FILL_MIN ? (
            <p className="text-xs text-copper">
              Low confidence — add chips or type the species. Everything stays editable.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {form.speciesSuggestedList
              .filter((name) => !form.speciesList.some((s) => s.toLowerCase() === name.toLowerCase()))
              .map((name) => (
                <button
                  key={name}
                  type="button"
                  className="rounded-full border border-line bg-card px-2.5 py-1 text-xs font-semibold"
                  onClick={() =>
                    patch({
                      speciesList: normalizeSpeciesList(null, [...form.speciesList, name]),
                      habitat: inferHabitat(name, form.habitat),
                      speciesSource: "edited",
                    })
                  }
                >
                  Add {name}
                </button>
              ))}
            {form.speciesAlternatives.map((alt) => (
              <button
                key={alt.species}
                type="button"
                className="rounded-full border border-line bg-card px-2.5 py-1 text-xs font-semibold"
                onClick={() =>
                  patch({
                    speciesList: normalizeSpeciesList(null, [...form.speciesList, alt.species]),
                    habitat: inferHabitat(alt.species, form.habitat),
                    speciesSource: "edited",
                  })
                }
              >
                Add {alt.species}
                {alt.confidence != null ? ` ${Math.round(alt.confidence * 100)}%` : ""}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-muted">
            Species ID is an assist, not a guarantee. Tag every fish in the photo.
          </p>
        </div>
      ) : (
        <p className="text-xs text-ink-muted">
          Species ID is an assist, not a guarantee. Tag every fish in the photo.
        </p>
      )}

      <CatchLocationFields
        form={form}
        onPlace={(placeName) => lockCatchLocation({ placeName })}
        onCoords={(lat, lng) => lockCatchLocation({ latitude: lat, longitude: lng })}
        onUsePhotoGps={() => {
          const lat = form.photoTakenLatitude;
          const lon = form.photoTakenLongitude;
          if (!lat || !lon) return;
          lockCatchLocation({ latitude: lat, longitude: lon });
        }}
        onMapPin={async (lat, lng) => {
          lockCatchLocation({ latitude: lat.toFixed(5), longitude: lng.toFixed(5) });
          try {
            const res = await fetch("/api/assist/place", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ latitude: lat, longitude: lng }),
            });
            const data = await res.json();
            if (data.place?.placeName) lockCatchLocation({ placeName: data.place.placeName });
            const at = new Date(form.caughtAt);
            const weatherRes = await fetch("/api/assist/weather", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                latitude: lat,
                longitude: lng,
                at: Number.isNaN(at.getTime()) ? undefined : at.toISOString(),
              }),
            });
            const weatherData = await weatherRes.json();
            const w = weatherData.weather;
            if (w) {
              patch(weatherFields(w, { includeMoon: !moonLocked }));
              setAssistNote(w.note);
            }
          } catch {
            /* map geocode is optional */
          }
        }}
      />

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
          <span className="mb-1 block text-sm font-semibold">Wind dir</span>
          <select
            value={form.windDirection}
            onChange={(e) => patch({ windDirection: e.target.value })}
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          >
            <option value="">Unknown</option>
            {WIND_DIRECTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
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
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Moon</span>
          <select
            value={form.moonPhase}
            onChange={(e) => {
              setMoonLocked(true);
              patch({ moonPhase: e.target.value });
            }}
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          >
            <option value="">Unknown</option>
            {MOON_PHASES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Moon %</span>
          <input
            inputMode="decimal"
            value={form.moonIllumination}
            onChange={(e) => {
              setMoonLocked(true);
              patch({ moonIllumination: e.target.value });
            }}
            placeholder="Illumination"
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Pressure inHg</span>
          <input
            inputMode="decimal"
            value={form.pressureInHg}
            onChange={(e) => {
              const value = e.target.value;
              const n = Number(value);
              patch({
                pressureInHg: value,
                pressureMb:
                  value.trim() && Number.isFinite(n) ? String(inHgToMb(n)) : form.pressureMb,
              });
            }}
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Pressure mb</span>
          <input
            inputMode="decimal"
            value={form.pressureMb}
            onChange={(e) => {
              const value = e.target.value;
              const n = Number(value);
              patch({
                pressureMb: value,
                pressureInHg:
                  value.trim() && Number.isFinite(n) ? String(mbToInHg(n)) : form.pressureInHg,
              });
            }}
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Pressure trend</span>
          <select
            value={form.pressureTrend}
            onChange={(e) => patch({ pressureTrend: e.target.value })}
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          >
            <option value="">Unknown</option>
            {PRESSURE_TRENDS.map((t) => (
              <option key={t} value={t}>
                {pressureTrendLabel(t)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {pastMode ? null : (
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">
          When
        </span>
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
              ...moonFields(d, moonLocked),
            });
          }}
          className="w-full rounded-xl border border-line bg-card px-3 py-3"
          required
        />
      </label>
      )}

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
            Off by default. {PRIVACY_LINE} Never public.
            {buddyNames.length
              ? ` This trip would go to: ${buddyNames.join(", ")}.`
              : " You have no linked buddies yet, so nobody else can see this."}
          </span>
        </span>
      </label>

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
        {saving
          ? "Saving…"
          : mode === "edit"
            ? "Save changes"
            : pastMode
              ? "Save past catch"
              : "Save catch"}
      </button>
    </form>
  );
}

function moonFields(d: Date, locked: boolean): Partial<FormState> {
  if (locked || Number.isNaN(d.getTime())) return {};
  const moon = moonForDate(d);
  return { moonPhase: moon.phase, moonIllumination: String(moon.illumination) };
}

function weatherFields(
  w: {
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
  },
  opts?: { includeMoon?: boolean },
): Partial<FormState> {
  const inHg =
    w.pressureInHg != null
      ? w.pressureInHg
      : w.pressureMb != null
        ? mbToInHg(w.pressureMb)
        : null;
  const mb =
    w.pressureMb != null
      ? w.pressureMb
      : w.pressureInHg != null
        ? inHgToMb(w.pressureInHg)
        : null;
  return {
    ...(w.temperatureF != null ? { temperatureF: String(w.temperatureF) } : {}),
    ...(w.weatherCondition ? { weatherCondition: w.weatherCondition } : {}),
    ...(w.windSpeedMph != null ? { windSpeedMph: String(w.windSpeedMph) } : {}),
    ...(w.windDirection ? { windDirection: w.windDirection } : {}),
    ...(w.precipitationIn != null ? { precipitationIn: String(w.precipitationIn) } : {}),
    ...(w.humidity != null ? { humidity: String(w.humidity) } : {}),
    ...(opts?.includeMoon !== false && w.moonPhase ? { moonPhase: w.moonPhase } : {}),
    ...(opts?.includeMoon !== false && w.moonIllumination != null
      ? { moonIllumination: String(w.moonIllumination) }
      : {}),
    ...(inHg != null ? { pressureInHg: String(inHg) } : {}),
    ...(mb != null ? { pressureMb: String(mb) } : {}),
    ...(w.pressureTrend ? { pressureTrend: w.pressureTrend } : {}),
  };
}

function joinDateTime(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "12:00"}`;
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

function CatchLocationFields({
  form,
  onPlace,
  onCoords,
  onUsePhotoGps,
  onMapPin,
}: {
  form: FormState;
  onPlace: (placeName: string) => void;
  onCoords: (lat: string, lng: string) => void;
  onUsePhotoGps: () => void;
  onMapPin: (lat: number, lng: number) => void;
}) {
  const catchLat = numOrNull(form.latitude);
  const catchLon = numOrNull(form.longitude);
  const photoLat = numOrNull(form.photoTakenLatitude);
  const photoLon = numOrNull(form.photoTakenLongitude);
  const photoDiffers = coordsLookDifferent(catchLat, catchLon, photoLat, photoLon);
  const hasPhotoGps = photoLat != null && photoLon != null;

  return (
    <section id="catch-location" className="space-y-3">
      <div>
        <p className="text-sm font-semibold">Catch location</p>
        <p className="text-xs text-ink-muted">
          Pin the water you caught it. Photo GPS is often the cooler, dock, or truck — that is not
          the catch spot. You can always move this pin.
        </p>
      </div>
      {hasPhotoGps ? (
        <div className="rounded-2xl border border-line bg-paper px-3 py-2 text-xs">
          <p>
            Photo taken at {formatCoords(photoLat, photoLon)}
            {photoDiffers ? " — different from the catch pin." : "."}
          </p>
          {photoDiffers || catchLat == null ? (
            <button type="button" className="mt-1 font-semibold text-teal" onClick={onUsePhotoGps}>
              Use photo GPS as catch pin
            </button>
          ) : null}
        </div>
      ) : null}
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Place name</span>
        <input
          value={form.placeName}
          onChange={(e) => onPlace(e.target.value)}
          placeholder="Lake, ramp, or hole name"
          className="w-full rounded-xl border border-line bg-card px-3 py-3"
        />
      </label>
      <MapPicker latitude={catchLat} longitude={catchLon} onChange={onMapPin} />
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Catch lat</span>
          <input
            inputMode="decimal"
            value={form.latitude}
            onChange={(e) => onCoords(e.target.value, form.longitude)}
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Catch long</span>
          <input
            inputMode="decimal"
            value={form.longitude}
            onChange={(e) => onCoords(form.latitude, e.target.value)}
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          />
        </label>
      </div>
    </section>
  );
}
