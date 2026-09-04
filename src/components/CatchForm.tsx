"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import exifr from "exifr";
import { MapPicker } from "./MapPicker";
import { PhotoCapture, type PhotoSource } from "./PhotoCapture";
import { SpeciesPicker } from "./SpeciesPicker";
import { AreaNamePicker } from "./AreaNamePicker";
import { DEFAULT_HABITAT } from "@/lib/habitat";
import { formatTideDetail, tidesApplyToHabitat } from "@/lib/tides/snapshot";
import { MOON_PHASES, moonForDate } from "@/lib/moon";
import { inHgToMb, mbToInHg, PRESSURE_TRENDS, pressureTrendLabel } from "@/lib/pressure";
import { PRIVACY_LINE } from "@/lib/privacy";
import { CONDITION_LABELS } from "@/lib/labels";
import { compressImage, photoSrc } from "@/lib/photo";
import {
  ALLOW_GPS_BUDGET_MS,
  ALLOW_GPS_FALLBACK_OPTIONS,
  ALLOW_GPS_OPTIONS,
  classifyCatchPinEdit,
  coordsLookDifferent,
  DROP_CATCH_PIN_HINT,
  DROPPING_PIN_HINT,
  formatCoords,
  initialLiveLocationStatusFromSaved,
  LIVE_CAMERA_GPS_BUDGET_MS,
  logLocationSurface,
  persistLogLocationOutcome,
  pinFromTurnedOnLocation,
  PINNED_FROM_PHONE_HINT,
  LOCATION_DENIED_SETTINGS_HINT,
  readSavedLiveLocation,
  readSavedLiveLocationStatus,
  refreshLiveLocationIfGranted,
  requestDeviceGpsAttempt,
  resolveCatchPinAfterPhotoAnswer,
  resolveLiveCameraCatchPin,
  resolveLiveCameraPinAfterPhoto,
  visibleCatchPinHint,
  waitForAllowLocationFix,
  waitForLiveLocationFix,
  writeSavedLiveLocation,
  type DeviceGpsAttempt,
  type LiveLocationStatus,
} from "@/lib/location";
import { readPhotoGps } from "@/lib/photo-gps";
import { primarySpecies } from "@/lib/species";
import {
  alignCountDrafts,
  countsFromDrafts,
  draftsFromCounts,
  draftFishCountForSpecies,
  countsForCatch,
  fishCountLabel,
  sanitizeFishCountDraft,
  totalFishCount,
} from "@/lib/count";
import { localDateKey } from "@/lib/calendar";
import { pathAfterScanCatchSave, removeScanQueueByPhotoPath, scanQueueCount } from "@/lib/scan-queue";
import { dateFromDatetimeLocal, datetimeLocalFromDate, datetimeLocalValue, formatTimeOnly, isoFromDatetimeLocal, parseExifStamp, PHOTO_EXIF_OPTIONS, seasonFromCaughtAtInput, seasonFromDate, timeOfDayFromCaughtAtInput, timeOfDayFromDate } from "@/lib/time";
import { TIDES, WEATHER_CONDITIONS } from "@/lib/types";
import { WIND_DIRECTIONS } from "@/lib/wind";
import type { CatchRecord, Habitat, NamedArea, Season, TimeOfDay } from "@/lib/types";

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
  tideHeightFt: string;
  tideDetail: string;
  waterClarity: string;
  habitat: Habitat;
  fishCount: string;
  speciesCountDrafts: Record<string, string>;
  sharedWithLinked: boolean;
  speciesAlternatives: { species: string; confidence: number }[];
  speciesSuggestedList: string[];
};

const emptyForm = (pastMode = false, caughtAtIso?: string | null): FormState => {
  const parsed = caughtAtIso ? parseExifStamp(caughtAtIso) ?? new Date(caughtAtIso) : new Date();
  const now = parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
  const moon = moonForDate(now);
  const hasStamp = Boolean(caughtAtIso && !Number.isNaN(now.getTime()));
  const caughtAt = pastMode && !hasStamp ? "" : datetimeLocalValue(now.toISOString());
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
    caughtAt,
    timeOfDay: (caughtAt && timeOfDayFromCaughtAtInput(caughtAt)) || timeOfDayFromDate(now),
    season: (caughtAt && seasonFromCaughtAtInput(caughtAt)) || seasonFromDate(now),
    notes: "",
    bait: "",
    tide: "",
    tideHeightFt: "",
    tideDetail: "",
    waterClarity: "",
    habitat: DEFAULT_HABITAT,
    fishCount: "1",
    speciesCountDrafts: {},
    sharedWithLinked: false,
    speciesAlternatives: [],
    speciesSuggestedList: [],
  };
};

function initialPinSource(initial: CatchRecord | undefined): "photo" | "device" | "manual" | null {
  if (
    initial?.photoTakenLatitude != null &&
    initial.photoTakenLongitude != null &&
    initial.latitude != null &&
    initial.longitude != null &&
    !coordsLookDifferent(
      initial.latitude,
      initial.longitude,
      initial.photoTakenLatitude,
      initial.photoTakenLongitude,
    )
  ) {
    return "photo";
  }
  if (initial?.latitude != null && initial.longitude != null) return "manual";
  return null;
}

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
    tideHeightFt: record.tideHeightFt != null ? String(record.tideHeightFt) : "",
    tideDetail: record.tideDetail ?? "",
    waterClarity: record.waterClarity ?? "",
    habitat: record.habitat,
    fishCount: String(record.fishCount ?? 1),
    speciesCountDrafts: draftsFromCounts(countsForCatch(record)),
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
  focusLocation = false,
}: {
  mode: "create" | "edit";
  initial?: CatchRecord;
  pastMode?: boolean;
  importedPhotoPath?: string | null;
  importedCaughtAt?: string | null;
  importedPhotoLat?: number | null;
  importedPhotoLon?: number | null;
  afterSave?: "detail" | "calendar";
  focusLocation?: boolean;
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
  const previewHold = useRef<string | null>(previewUrl);

  function showPreview(next: string | null) {
    if (next) previewHold.current = next;
    setPreviewUrl(next ?? previewHold.current);
  }
  const [assistNote, setAssistNote] = useState<string | null>(null);
  const [pinHint, setPinHint] = useState<string | null>(null);
  const [photoAtCatch, setPhotoAtCatch] = useState<boolean | null>(null);
  const pendingPhotoGpsRef = useRef<{ latitude: number; longitude: number } | null>(
    importedPhotoLat != null && importedPhotoLon != null
      ? { latitude: importedPhotoLat, longitude: importedPhotoLon }
      : initial?.photoTakenLatitude != null && initial.photoTakenLongitude != null
        ? { latitude: initial.photoTakenLatitude, longitude: initial.photoTakenLongitude }
        : null,
  );
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Reading the photo…");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [buddyNames, setBuddyNames] = useState<string[]>([]);
  const [moonLocked, setMoonLocked] = useState(false);
  const [tideLocked, setTideLocked] = useState(false);
  const [catchPinUserMoved, setCatchPinUserMoved] = useState(
    Boolean(mode === "edit" && initial?.latitude != null && initial?.longitude != null),
  );
  const catchPinUserMovedRef = useRef(catchPinUserMoved);
  const [pinSource, setPinSource] = useState<"photo" | "device" | "manual" | null>(() =>
    initialPinSource(initial),
  );
  const pendingLiveGpsRef = useRef<{ latitude: number; longitude: number } | null>(
    mode === "create" && !pastMode ? readSavedLiveLocation() : null,
  );
  const liveGpsRequestRef = useRef<Promise<{ latitude: number; longitude: number } | null> | null>(
    null,
  );
  const [locationStatus, setLocationStatus] = useState<LiveLocationStatus>(() => {
    if (mode !== "create" || pastMode) return "unavailable";
    return initialLiveLocationStatusFromSaved(readSavedLiveLocationStatus());
  });
  const [osDenied, setOsDenied] = useState(
    () => mode === "create" && !pastMode && readSavedLiveLocationStatus() === "denied",
  );
  const locationStatusRef = useRef<LiveLocationStatus>(locationStatus);
  const rememberLiveGpsRef = useRef<(gps: { latitude: number; longitude: number } | null) => void>(
    () => {},
  );
  const photoOnFormRef = useRef(Boolean(previewUrl || photoFile || importedPhotoPath));
  const pinEmptyRef = useRef(!form.latitude.trim());
  photoOnFormRef.current = Boolean(previewHold.current || photoFile || importedPhotoPath);
  pinEmptyRef.current = !form.latitude.trim();
  const useLiveGps = mode === "create" && !pastMode;

  useEffect(() => {
    catchPinUserMovedRef.current = catchPinUserMoved;
  }, [catchPinUserMoved]);

  useEffect(() => {
    locationStatusRef.current = locationStatus;
  }, [locationStatus]);

  useEffect(() => {
    if (!useLiveGps) return;
    const saved = readSavedLiveLocation();
    const savedStatus = readSavedLiveLocationStatus();
    if (saved) rememberLiveGpsRef.current(saved);
    if (savedStatus !== "ready" && savedStatus !== "allowed") return;
    let cancelled = false;
    const ac = new AbortController();
    const pending = saved
      ? refreshLiveLocationIfGranted({ savedStatus })
      : waitForLiveLocationFix({
          signal: ac.signal,
          budgetMs: ALLOW_GPS_BUDGET_MS,
          options: ALLOW_GPS_FALLBACK_OPTIONS,
        }).then((result) => (result.ok ? result.gps : null));
    liveGpsRequestRef.current = pending;
    void pending.then((gps) => {
      if (cancelled || !gps) return;
      writeSavedLiveLocation(gps);
      rememberLiveGpsRef.current(gps);
    });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [useLiveGps]);

  useEffect(() => {
    if (!importedPhotoPath) return;
    const src = photoSrc(importedPhotoPath);
    if (src) showPreview(src);
  }, [importedPhotoPath]);

  useEffect(() => {
    if (!focusLocation) return;
    document.getElementById("catch-location")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusLocation]);

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

  function patch(partial: Partial<FormState>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  function markCatchPinMoved(partial: Partial<FormState>) {
    catchPinUserMovedRef.current = true;
    setCatchPinUserMoved(true);
    setPinSource("manual");
    patch(partial);
  }

  useEffect(() => {
    const lat = numOrNull(form.latitude);
    const lon = numOrNull(form.longitude);
    const at = caughtDate(form.caughtAt);
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
          ...(data.weather ? weatherFields(data.weather, { includeMoon: !moonLocked }) : {}),
          ...tideFields(data.tide, tideLocked),
        }));
        const notes = [data.weather?.note, data.tide?.note].filter(Boolean);
        if (notes.length) setAssistNote(notes.join(" "));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [form.caughtAt, form.latitude, form.longitude, form.habitat, moonLocked, tideLocked]);

  function rememberLiveGps(gps: { latitude: number; longitude: number } | null) {
    if (!gps) return;
    pendingLiveGpsRef.current = gps;
    locationStatusRef.current = "ready";
    setLocationStatus("ready");
    const next = pinFromTurnedOnLocation({
      hasPhoto: photoOnFormRef.current,
      pinEmpty: pinEmptyRef.current,
      userMovedCatchPin: catchPinUserMovedRef.current,
      gps,
    });
    if (next) void applyResolvedPin(next);
  }
  rememberLiveGpsRef.current = rememberLiveGps;

  function onLocationAttempt(attempt: Promise<DeviceGpsAttempt>) {
    setLocationStatus("asking");
    locationStatusRef.current = "asking";
    setOsDenied(false);
    const pending = attempt.then((result) => {
      const outcome = persistLogLocationOutcome(result);
      if (result.ok) {
        setOsDenied(false);
        rememberLiveGps(result.gps);
        return result.gps;
      }
      locationStatusRef.current = outcome.uiStatus;
      setLocationStatus(outcome.uiStatus);
      setOsDenied(outcome.osDenied);
      return null;
    });
    liveGpsRequestRef.current = pending;
  }

  async function applyResolvedPin(next: {
    latitude: number;
    longitude: number;
    source: "photo" | "device" | "manual";
  }) {
    patch({
      latitude: next.latitude.toFixed(5),
      longitude: next.longitude.toFixed(5),
    });
    setPinSource(next.source);
    if (next.source === "photo") {
      setPinHint(
        "Catch pin auto-filled from this photo’s location stamp. Drag it if you caught the fish somewhere else — the pin is not locked.",
      );
    } else {
      setPinHint(PINNED_FROM_PHONE_HINT);
    }
    try {
      const res = await fetch("/api/assist/place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: next.latitude, longitude: next.longitude }),
      });
      const data = await res.json();
      const autoPlace = data.place?.placeName as string | undefined;
      if (autoPlace) {
        setForm((f) => (f.placeName.trim() ? f : { ...f, placeName: autoPlace }));
      }
    } catch {
      /* place name is optional */
    }
  }

  async function handleFile(file: File, source: PhotoSource = "library") {
    setError(null);
    setBusy(true);
    setBusyLabel("Reading the photo…");
    setPhotoAtCatch(source === "camera" && !pastMode ? true : null);
    setPinHint(null);
    try {
      const photoGps = await readPhotoGps(file);
      if (photoGps) {
        pendingPhotoGpsRef.current = photoGps;
        patch({
          photoTakenLatitude: photoGps.latitude.toFixed(5),
          photoTakenLongitude: photoGps.longitude.toFixed(5),
        });
      } else {
        pendingPhotoGpsRef.current = null;
        patch({ photoTakenLatitude: "", photoTakenLongitude: "" });
      }
      const exif = (await exifr.parse(file, PHOTO_EXIF_OPTIONS)) as {
        DateTimeOriginal?: string | Date;
        CreateDate?: string | Date;
      } | undefined;
      const stamp = parseExifStamp(exif?.DateTimeOriginal ?? exif?.CreateDate);
      if (stamp) {
        const caughtAt = datetimeLocalFromDate(stamp);
        patch({
          ...clockFromCaughtAt(caughtAt),
          ...moonFields(stamp, moonLocked),
        });
      }
    } catch {
      pendingPhotoGpsRef.current = null;
    }
    const compressed = await compressImage(file);
    const nextFile = new File([compressed], file.name.replace(/\.\w+$/, ".jpg"), {
      type: "image/jpeg",
    });
    setPhotoFile(nextFile);
    const url = URL.createObjectURL(nextFile);
    showPreview(url);

    if (!pastMode && source === "camera") {
      setBusyLabel(DROPPING_PIN_HINT);
      setPinHint(DROPPING_PIN_HINT);
      const fromTap = liveGpsRequestRef.current ? await liveGpsRequestRef.current : null;
      const savedGps = pendingLiveGpsRef.current ?? readSavedLiveLocation() ?? fromTap;
      const savedStatus = readSavedLiveLocationStatus();
      const { pin, deviceGps } = savedGps
        ? {
            deviceGps: savedGps,
            pin: resolveLiveCameraCatchPin({
              userMovedCatchPin: catchPinUserMovedRef.current,
              deviceGps: savedGps,
            }),
          }
        : await resolveLiveCameraPinAfterPhoto({
            userMovedCatchPin: catchPinUserMovedRef.current,
            savedGps: null,
            savedStatus: savedStatus === "unavailable" ? "allowed" : savedStatus,
          });
      if (deviceGps) {
        pendingLiveGpsRef.current = deviceGps;
        writeSavedLiveLocation(deviceGps);
        locationStatusRef.current = "ready";
        setLocationStatus("ready");
      }
      if (pin) {
        await applyResolvedPin(pin);
      } else if (catchPinUserMovedRef.current) {
        setPinHint(
          "Catch pin left where you moved it. Re-taking this picture will not overwrite your pin.",
        );
      } else {
        setPinHint(null);
      }
    }

    setBusy(false);
    setBusyLabel("Reading the photo…");
  }

  async function answerPhotoAtCatch(yes: boolean) {
    setPhotoAtCatch(yes);
    if (!yes) {
      setPinHint(numOrNull(form.latitude) == null ? DROP_CATCH_PIN_HINT : null);
      return;
    }

    setBusy(true);
    try {
      const photoGps = pendingPhotoGpsRef.current;
      let deviceGps: { latitude: number; longitude: number } | null = null;
      if (!photoGps) {
        setPinHint(DROPPING_PIN_HINT);
        deviceGps = pendingLiveGpsRef.current ?? readSavedLiveLocation();
        if (!deviceGps && liveGpsRequestRef.current) {
          deviceGps = await liveGpsRequestRef.current;
        }
        if (!deviceGps) {
          const first = requestDeviceGpsAttempt(undefined, ALLOW_GPS_OPTIONS);
          const result = await waitForAllowLocationFix({
            firstAttempt: first,
            budgetMs: LIVE_CAMERA_GPS_BUDGET_MS,
          });
          deviceGps = result.ok ? result.gps : null;
        }
      }

      const next = resolveCatchPinAfterPhotoAnswer({
        photoTakenAtCatch: true,
        userMovedCatchPin: catchPinUserMovedRef.current,
        photoGps,
        deviceGps,
        pastMode,
      });

      if (!next) {
        if (catchPinUserMovedRef.current) {
          setPinHint(
            "Catch pin left where you moved it. Photo GPS is only “photo taken at,” and re-saving this picture will not overwrite your pin.",
          );
        } else if (!photoGps && !deviceGps) {
          setPinHint(
            "No GPS in the photo and this phone did not share a location. Tap the map to place the pin.",
          );
        } else {
          setPinHint(DROP_CATCH_PIN_HINT);
        }
        return;
      }

      await applyResolvedPin(next);
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
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
        ...clockFromCaughtAt(form.caughtAt),
        caughtAt: isoFromDatetimeLocal(form.caughtAt),
        notes: form.notes || null,
        bait: form.bait || null,
        tide: form.tide || null,
        tideHeightFt: numOrNull(form.tideHeightFt),
        tideDetail: form.tideDetail || null,
        waterClarity: form.waterClarity || null,
        habitat: form.habitat,
        ...(() => {
          const rows = countsFromDrafts(form.speciesList, form.speciesCountDrafts, form.fishCount);
          return { fishCount: totalFishCount(rows), speciesCounts: rows };
        })(),
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
      const fromScan = Boolean(importedPhotoPath && pastMode);
      if (fromScan) {
        removeScanQueueByPhotoPath(photoPath ?? importedPhotoPath ?? "");
      }
      router.push(
        pathAfterScanCatchSave({
          remainingCount: fromScan ? scanQueueCount() : 0,
          afterSave,
          catchId: data.catch.id,
          dayKey: localDateKey(data.catch.caughtAt),
        }),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const locationUi = logLocationSurface({
    status: locationStatus,
    hasPin: Boolean(form.latitude.trim()),
    photoAtCatch,
    osDenied,
  });
  const copperPinHint = visibleCatchPinHint({
    pinHint,
    liveLog: useLiveGps,
    locationStatus,
  });

  return (
    <form onSubmit={onSubmit} className="flex w-full min-w-0 max-w-full flex-col gap-4">
      <PhotoCapture
        previewUrl={previewUrl}
        onFile={handleFile}
        busy={busy}
        busyLabel={busyLabel}
        emphasis={pastMode ? "library" : "camera"}
        libraryOnly={pastMode}
        compactPreview={pastMode && Boolean(previewUrl)}
        locationStatus={useLiveGps && photoAtCatch !== false ? locationStatus : undefined}
        onTurnLocationOn={useLiveGps && photoAtCatch !== false ? onLocationAttempt : undefined}
        locationReason={
          useLiveGps && osDenied
            ? LOCATION_DENIED_SETTINGS_HINT
            : useLiveGps && locationStatus === "ready" && Boolean(form.latitude.trim())
              ? PINNED_FROM_PHONE_HINT
              : undefined
        }
      />

      {!busy &&
      photoAtCatch === null &&
      Boolean(photoFile || (mode === "create" && importedPhotoPath)) ? (
        <div
          data-testid="photo-at-catch-prompt"
          className="rounded-2xl border border-line bg-card px-3 py-3"
        >
          <p className="text-[15px] font-semibold text-ink">
            Was this photo taken where you caught the fish?
          </p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="photo-at-catch-yes"
              onClick={() => void answerPhotoAtCatch(true)}
              className="rounded-xl bg-teal py-3 text-base font-semibold text-white"
            >
              Yes
            </button>
            <button
              type="button"
              data-testid="photo-at-catch-no"
              onClick={() => void answerPhotoAtCatch(false)}
              className="rounded-xl border border-line bg-paper py-3 text-base font-semibold text-ink"
            >
              No
            </button>
          </div>
        </div>
      ) : null}

      {copperPinHint ? (
        <p
          data-testid="catch-pin-hint"
          className="rounded-2xl border border-copper bg-paper-deep px-3 py-2 text-sm font-medium text-ink"
        >
          {copperPinHint}
        </p>
      ) : null}

      {assistNote && !pastMode ? (
        <p className="rounded-2xl border border-copper bg-paper-deep px-3 py-2 text-sm font-medium text-ink">
          {assistNote}
        </p>
      ) : null}

      {pastMode ? (
        <>
          <div>
            <p className="on-wash-chip mb-1 w-fit text-sm font-semibold">When you caught it</p>
            <div className="grid min-w-0 grid-cols-2 gap-3">
              <label className="block min-w-0">
                <span className="on-wash-chip mb-1 inline-block text-xs">Date</span>
                <input
                  type="date"
                  value={form.caughtAt.slice(0, 10)}
                  onChange={(e) => {
                    const next = joinDateTime(e.target.value, form.caughtAt.slice(11, 16) || "12:00");
                    const d = caughtDate(next);
                    patch({
                      ...clockFromCaughtAt(next),
                      ...moonFields(d, moonLocked),
                    });
                  }}
                  className="w-full min-w-0 rounded-xl border border-line bg-card px-3 py-3"
                  required
                />
              </label>
              <label className="block min-w-0">
                <span className="on-wash-chip mb-1 inline-block text-xs">Time</span>
                <input
                  type="time"
                  value={form.caughtAt.slice(11, 16)}
                  onChange={(e) => {
                    const day = form.caughtAt.slice(0, 10);
                    if (!day) return;
                    const next = joinDateTime(day, e.target.value);
                    const d = caughtDate(next);
                    patch({
                      ...clockFromCaughtAt(next),
                      ...moonFields(d, moonLocked),
                    });
                  }}
                  className="w-full min-w-0 rounded-xl border border-line bg-card px-3 py-3"
                  required
                />
              </label>
            </div>
          </div>
        </>
      ) : null}

      <CatchLocationFields
        form={form}
        pinSource={pinSource}
        hideHints={pastMode}
        emptyPinHint={
          pastMode
            ? photoAtCatch === false && !form.latitude.trim()
              ? DROP_CATCH_PIN_HINT
              : null
            : locationUi.emptyMapBanner
        }
        onPlace={(placeName) => patch({ placeName })}
        onSelectArea={(area) => {
          patch({ placeName: area.name });
        }}
        onCoords={(lat, lng) => {
          patch({ latitude: lat, longitude: lng });
          const nextLat = numOrNull(lat);
          const nextLon = numOrNull(lng);
          if (nextLat == null || nextLon == null) return;
          const photoLat = numOrNull(form.photoTakenLatitude);
          const photoLon = numOrNull(form.photoTakenLongitude);
          if (classifyCatchPinEdit({ nextLat, nextLon, photoLat, photoLon }) === "matches-photo") {
            catchPinUserMovedRef.current = false;
            setCatchPinUserMoved(false);
            setPinSource("photo");
            return;
          }
          catchPinUserMovedRef.current = true;
          setCatchPinUserMoved(true);
          setPinSource("manual");
        }}
        onUsePhotoGps={() => {
          const lat = form.photoTakenLatitude;
          const lon = form.photoTakenLongitude;
          if (!lat || !lon) return;
          catchPinUserMovedRef.current = false;
          setCatchPinUserMoved(false);
          setPinSource("photo");
          patch({ latitude: lat, longitude: lon });
        }}
        onMapPin={async (lat, lng) => {
          setPinHint(null);
          markCatchPinMoved({ latitude: lat.toFixed(5), longitude: lng.toFixed(5) });
          try {
            const res = await fetch("/api/assist/place", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ latitude: lat, longitude: lng }),
            });
            const data = await res.json();
            if (data.place?.placeName) {
              setForm((f) => (f.placeName.trim() ? f : { ...f, placeName: data.place.placeName }));
            }
            const at = caughtDate(form.caughtAt);
            const weatherRes = await fetch("/api/assist/weather", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                latitude: lat,
                longitude: lng,
                at: Number.isNaN(at.getTime()) ? undefined : at.toISOString(),
                habitat: form.habitat,
              }),
            });
            const weatherData = await weatherRes.json();
            const w = weatherData.weather;
            patch({
              ...(w ? weatherFields(w, { includeMoon: !moonLocked }) : {}),
              ...tideFields(weatherData.tide, tideLocked),
            });
            const notes = [w?.note, weatherData.tide?.note].filter(Boolean);
            if (notes.length) setAssistNote(notes.join(" "));
          } catch {
            /* map geocode is optional */
          }
        }}
      />

      <SpeciesPicker
        speciesList={form.speciesList}
        habitat={form.habitat}
        hideHints
        onHabitat={(habitat) => {
          if (!tidesApplyToHabitat(habitat)) setTideLocked(false);
          patch(habitatPatch(habitat));
        }}
        onChange={(speciesList, habitat) => {
          if (!tidesApplyToHabitat(habitat)) setTideLocked(false);
          const speciesCountDrafts = alignCountDrafts(
            speciesList,
            form.speciesCountDrafts,
            form.fishCount,
          );
          patch({
            speciesList,
            ...habitatPatch(habitat),
            speciesCountDrafts,
            fishCount:
              speciesList.length <= 1
                ? draftFishCountForSpecies(form.fishCount)
                : String(totalFishCount(countsFromDrafts(speciesList, speciesCountDrafts, form.fishCount))),
            speciesSource: "manual",
          });
        }}
      />

      {form.speciesList.length > 1 ? (
        <div className="space-y-2">
          <p className="on-wash-chip w-fit text-sm font-semibold">How many of each</p>
          {form.speciesList.map((name) => (
            <label key={name} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                value={form.speciesCountDrafts[name] ?? ""}
                onChange={(e) =>
                  patch({
                    speciesCountDrafts: {
                      ...form.speciesCountDrafts,
                      [name]: sanitizeFishCountDraft(e.target.value),
                    },
                  })
                }
                onBlur={() =>
                  patch({
                    speciesCountDrafts: {
                      ...form.speciesCountDrafts,
                      [name]: draftFishCountForSpecies(form.speciesCountDrafts[name] ?? ""),
                    },
                  })
                }
                className="w-20 rounded-xl border border-line bg-card px-3 py-2 text-center"
              />
            </label>
          ))}
          <p className="on-wash-chip text-xs">
            {fishCountLabel(
              totalFishCount(
                countsFromDrafts(form.speciesList, form.speciesCountDrafts, form.fishCount),
              ),
            )}
            {pastMode ? null : " this catch. Empty boxes become 1."}
          </p>
        </div>
      ) : (
        <label className="block">
          <span className="on-wash-chip mb-1 inline-block text-sm font-semibold">How many fish</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={form.fishCount}
            onChange={(e) => patch({ fishCount: sanitizeFishCountDraft(e.target.value) })}
            onBlur={() =>
              patch({
                fishCount: draftFishCountForSpecies(form.fishCount),
              })
            }
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          />
        </label>
      )}

      <details className="app-more rounded-2xl border border-line bg-card">
        <summary className="cursor-pointer px-3 py-3">
          <span>
            <span className="block text-sm font-semibold">Weather & time</span>
            <span className="mt-0.5 block text-xs font-normal text-ink-muted">
              {weatherSummary(form, pastMode)}
            </span>
          </span>
        </summary>
        <div className="space-y-3 px-3 pb-3">
            {pastMode ? null : (
            <p className="text-xs text-ink-muted">
              Fills in from the pin and clock. Open this only to correct it.
            </p>
            )}
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
        {tidesApplyToHabitat(form.habitat) ? (
          <>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Tide</span>
              <select
                value={form.tide}
                onChange={(e) => {
                  setTideLocked(true);
                  patch({ tide: e.target.value });
                }}
                className="w-full rounded-xl border border-line bg-card px-3 py-3"
              >
                <option value="">Unknown</option>
                {TIDES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Tide ft</span>
              <input
                inputMode="decimal"
                value={form.tideHeightFt}
                onChange={(e) => {
                  setTideLocked(true);
                  patch({ tideHeightFt: e.target.value });
                }}
                className="w-full rounded-xl border border-line bg-card px-3 py-3"
              />
            </label>
            {form.tideDetail ? (
              <p className="col-span-2 text-xs text-ink-muted">{form.tideDetail}</p>
            ) : pastMode ? null : (
            <p className="col-span-2 text-xs text-ink-muted">
              High/low fills in from the pin and clock.
            </p>
            )}
          </>
        ) : pastMode ? null : (
          <p className="col-span-2 text-xs text-ink-muted">
            Tide does not apply to this older freshwater trip.
          </p>
        )}
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
            const d = caughtDate(value);
            patch({
              ...clockFromCaughtAt(value),
              ...moonFields(d, moonLocked),
            });
          }}
          className="w-full rounded-xl border border-line bg-card px-3 py-3"
        />
        <span className="mt-1 block text-xs text-ink-muted">
          Calendar Log shows this clock. A photo stamp fills it in.
        </span>
      </label>
      )}
        </div>
      </details>

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

      <details className="app-more">
        <summary className="on-wash-chip w-fit cursor-pointer text-sm font-semibold text-teal">
          Bait, water, notes
        </summary>
        <div className="mt-3 grid gap-3">
          <input
            value={form.bait}
            onChange={(e) => patch({ bait: e.target.value })}
            placeholder="Bait / lure / fly"
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          />
          <input
            value={form.waterClarity}
            onChange={(e) => patch({ waterClarity: e.target.value })}
            placeholder="Water clarity"
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          />
          <textarea
            value={form.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="What worked, what didn't"
            rows={3}
            className="w-full rounded-xl border border-line bg-card px-3 py-3"
          />
          <label className="flex items-start gap-2 rounded-2xl border border-line bg-card px-3 py-3 text-sm">
            <input
              type="checkbox"
              checked={form.sharedWithLinked}
              onChange={(e) => patch({ sharedWithLinked: e.target.checked })}
              className="mt-1"
            />
            <span>
              <span className="font-semibold">Share with linked friends</span>
              <span className="mt-0.5 block text-xs text-ink-muted">
                Off by default. Linking a friend does not share this trip. {PRIVACY_LINE} Never
                public.
                {buddyNames.length
                  ? ` This trip would go to: ${buddyNames.join(", ")}.`
                  : " You have no linked friends yet, so nobody else can see this."}
              </span>
            </span>
          </label>
        </div>
      </details>
    </form>
  );
}

function moonFields(d: Date, locked: boolean): Partial<FormState> {
  if (locked || Number.isNaN(d.getTime())) return {};
  const moon = moonForDate(d);
  return { moonPhase: moon.phase, moonIllumination: String(moon.illumination) };
}

function clockFromCaughtAt(value: string): Pick<FormState, "caughtAt" | "timeOfDay" | "season"> {
  const d = caughtDate(value);
  return {
    caughtAt: value,
    timeOfDay: timeOfDayFromCaughtAtInput(value) ?? (Number.isNaN(d.getTime()) ? "afternoon" : timeOfDayFromDate(d)),
    season: seasonFromCaughtAtInput(value) ?? (Number.isNaN(d.getTime()) ? "summer" : seasonFromDate(d)),
  };
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
  locked: boolean,
): Partial<FormState> {
  if (locked || !t) return {};
  if (t.applies === false) {
    return { tide: "", tideHeightFt: "", tideDetail: "" };
  }
  const detail = formatTideDetail(t);
  return {
    ...(t.tide ? { tide: t.tide } : {}),
    ...(t.heightFt != null ? { tideHeightFt: String(t.heightFt) } : {}),
    ...(detail ? { tideDetail: detail } : {}),
  };
}

function habitatPatch(habitat: Habitat): Partial<FormState> {
  if (tidesApplyToHabitat(habitat)) return { habitat };
  return { habitat, tide: "", tideHeightFt: "", tideDetail: "" };
}

function weatherSummary(form: FormState, quiet = false): string {
  const parts: string[] = [];
  if (form.caughtAt.trim()) {
    parts.push(formatTimeOnly(isoFromDatetimeLocal(form.caughtAt)));
  }
  if (form.temperatureF.trim()) parts.push(`${form.temperatureF}°`);
  if (form.weatherCondition) {
    parts.push(
      form.weatherCondition in CONDITION_LABELS
        ? CONDITION_LABELS[form.weatherCondition as keyof typeof CONDITION_LABELS]
        : form.weatherCondition,
    );
  }
  if (form.windSpeedMph.trim()) {
    parts.push(
      form.windDirection
        ? `${form.windSpeedMph} mph ${form.windDirection}`
        : `${form.windSpeedMph} mph`,
    );
  }
  if (tidesApplyToHabitat(form.habitat) && form.tide) {
    parts.push(`${form.tide.charAt(0).toUpperCase()}${form.tide.slice(1)} tide`);
  }
  if (form.moonPhase) parts.push(form.moonPhase);
  if (form.pressureInHg.trim()) parts.push(`${form.pressureInHg} inHg`);
  return parts.length ? parts.join(" · ") : quiet ? "" : "Fills in from the pin and clock";
}

function joinDateTime(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "12:00"}`;
}

function caughtDate(value: string): Date {
  return dateFromDatetimeLocal(value) ?? new Date(value);
}

function numOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function CatchLocationFields({
  form,
  pinSource,
  hideHints = false,
  emptyPinHint = null,
  onPlace,
  onSelectArea,
  onCoords,
  onUsePhotoGps,
  onMapPin,
}: {
  form: FormState;
  pinSource: "photo" | "device" | "manual" | null;
  hideHints?: boolean;
  emptyPinHint?: string | null;
  onPlace: (placeName: string) => void;
  onSelectArea: (area: NamedArea) => void;
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
        <p className="on-wash-chip w-fit text-sm font-semibold">Catch location</p>
        {hideHints ? null : (
          <p className="on-wash-chip text-xs">
            Pick or name the area, then drop one pin for this catch. Drag if the photo GPS is the
            truck, not the water.
          </p>
        )}
      </div>
      {hideHints ? (
        <>
          {hasPhotoGps && photoDiffers ? (
            <button type="button" className="on-wash-chip w-fit text-sm font-semibold text-teal" onClick={onUsePhotoGps}>
              Reset to photo GPS
            </button>
          ) : hasPhotoGps && catchLat == null ? (
            <button type="button" className="on-wash-chip w-fit text-sm font-semibold text-teal" onClick={onUsePhotoGps}>
              Use photo GPS
            </button>
          ) : null}
          {catchLat == null && emptyPinHint ? (
            <div className="rounded-2xl border border-dashed border-line bg-paper px-3 py-2 text-xs">
              {emptyPinHint}
            </div>
          ) : null}
        </>
      ) : pinSource === "photo" && catchLat != null ? (
        <div className="rounded-2xl border border-teal/40 bg-paper px-3 py-2 text-xs">
          <p>
            <span className="font-semibold text-teal">From this photo.</span> Drag if you caught it
            somewhere else.
          </p>
        </div>
      ) : hasPhotoGps && photoDiffers ? (
        <div className="rounded-2xl border border-line bg-paper px-3 py-2 text-xs">
          <p>
            <span className="font-semibold">You moved the pin.</span> Re-saving the photo will not
            overwrite it.
          </p>
          <button type="button" className="mt-1 font-semibold text-teal" onClick={onUsePhotoGps}>
            Reset to photo GPS
          </button>
        </div>
      ) : pinSource === "device" && catchLat != null ? (
        <div className="rounded-2xl border border-line bg-paper px-3 py-2 text-xs">
          <p>
            <span className="font-semibold">From this phone.</span> Drag if that isn’t the water.
          </p>
        </div>
      ) : catchLat == null && emptyPinHint ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper px-3 py-2 text-xs">
          {emptyPinHint}
        </div>
      ) : null}
      {hideHints ? null : hasPhotoGps ? (
        <div className="rounded-2xl border border-line bg-paper px-3 py-2 text-xs">
          <p>
            Photo GPS {formatCoords(photoLat, photoLon)}
            {photoDiffers ? " — different from the pin." : "."}
          </p>
          {catchLat == null ? (
            <button type="button" className="mt-1 font-semibold text-teal" onClick={onUsePhotoGps}>
              Use photo GPS
            </button>
          ) : null}
        </div>
      ) : null}
      <AreaNamePicker
        value={form.placeName}
        onChange={onPlace}
        onPickArea={onSelectArea}
        hideHints={hideHints}
      />
      <MapPicker latitude={catchLat} longitude={catchLon} onChange={onMapPin} hideHints={hideHints} />
      <details className="app-more">
        <summary className="cursor-pointer text-sm font-semibold text-teal">Coordinates</summary>
        <div className="mt-3 grid min-w-0 grid-cols-2 gap-3">
          <label className="block min-w-0">
            <span className="mb-1 block text-sm font-semibold">Catch lat</span>
            <input
              inputMode="decimal"
              value={form.latitude}
              onChange={(e) => onCoords(e.target.value, form.longitude)}
              className="w-full min-w-0 rounded-xl border border-line bg-card px-3 py-3"
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-sm font-semibold">Catch long</span>
            <input
              inputMode="decimal"
              value={form.longitude}
              onChange={(e) => onCoords(form.latitude, e.target.value)}
              className="w-full min-w-0 rounded-xl border border-line bg-card px-3 py-3"
            />
          </label>
        </div>
      </details>
    </section>
  );
}
