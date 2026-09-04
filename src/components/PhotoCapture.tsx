"use client";

import { useRef, useState } from "react";
import { SaveToPhotosButton } from "@/components/SaveToPhotosButton";
import {
  GETTING_LOCATION_LABEL,
  TURN_LOCATION_ON_LABEL,
  handleTurnLocationOnClick,
  isBlockedLocationReason,
  liveCameraTapAction,
  logLocationReason,
  shouldShowTurnLocationOn,
  type DeviceGpsAttempt,
  type GeolocationPermissionState,
  type LiveLocationStatus,
} from "@/lib/location";

export type PhotoSource = "camera" | "library";

export function PhotoCapture({
  previewUrl,
  onFile,
  busy,
  busyLabel = "Reading the photo…",
  emphasis = "camera",
  emptyTitle,
  emptyHint,
  compactPreview = false,
  libraryOnly = false,
  locationReason,
  locationStatus,
  onTurnLocationOn,
  onLiveCamera,
}: {
  previewUrl: string | null;
  onFile: (file: File, source: PhotoSource) => void;
  busy?: boolean;
  busyLabel?: string;
  emphasis?: "camera" | "library";
  emptyTitle?: string;
  emptyHint?: string;
  compactPreview?: boolean;
  libraryOnly?: boolean;
  locationReason?: string;
  locationStatus?: LiveLocationStatus;
  onTurnLocationOn?: (
    attempt: Promise<DeviceGpsAttempt>,
    meta?: { permission: Promise<GeolocationPermissionState>; privateBrowsing: boolean },
  ) => void;
  onLiveCamera?: () => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const startingRef = useRef(false);
  const [tapBusy, setTapBusy] = useState(false);

  const waiting = locationStatus === "asking" || tapBusy;
  const showTurnOn =
    Boolean(onTurnLocationOn) &&
    (waiting || (locationStatus != null && shouldShowTurnLocationOn(locationStatus)));
  const blockedWhileAsking =
    waiting && locationReason != null && isBlockedLocationReason(locationReason);
  const reasonText = blockedWhileAsking
    ? locationReason
    : waiting
      ? GETTING_LOCATION_LABEL
      : (locationReason ?? (locationStatus ? logLocationReason(locationStatus) : null));

  function startLocationFromThisTap(): Promise<DeviceGpsAttempt> | null {
    if (startingRef.current) return null;
    startingRef.current = true;
    const start = handleTurnLocationOnClick();
    const { attempt } = start;
    setTapBusy(true);
    onTurnLocationOn?.(attempt, {
      permission: start.permission,
      privateBrowsing: start.privateBrowsing,
    });
    void attempt.finally(() => {
      startingRef.current = false;
      setTapBusy(false);
    });
    return attempt;
  }

  function onTurnLocationGesture(event: { preventDefault: () => void; stopPropagation: () => void }) {
    if (waiting) return;
    startLocationFromThisTap();
    event.preventDefault();
    event.stopPropagation();
  }

  function openCamera() {
    const action = liveCameraTapAction(locationStatus);
    if (action === "wait") return;
    if (action === "start-gps" && onTurnLocationOn) {
      startLocationFromThisTap();
      return;
    }
    onLiveCamera?.();
    cameraRef.current?.click();
  }

  const pick = () => {
    if (libraryOnly) libraryRef.current?.click();
    else openCamera();
  };
  const hint =
    emptyHint === undefined
      ? libraryOnly || emphasis === "library"
        ? "Pick an old catch photo from your camera roll. We’ll ask if it was taken where you caught the fish before dropping a pin."
        : "Camera opens on this tap. Location from sign-in pins the catch if you allowed it."
      : emptyHint;

  return (
    <div
      className="journal-card box-border w-full max-w-full min-w-0 overflow-hidden rounded-3xl"
      data-testid={libraryOnly && previewUrl ? "backfill-photo" : undefined}
    >
      <div
        className={`relative w-full ${
          previewUrl ? "bg-paper-deep" : "photo-capture-brand"
        } ${compactPreview && previewUrl ? "h-40" : "aspect-[4/3]"}`}
        data-testid={previewUrl ? undefined : "photo-capture-brand"}
      >
        <button type="button" onClick={pick} className="block h-full w-full">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Catch photo" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-w-0 flex-col items-center justify-end gap-2 bg-gradient-to-t from-ink/75 via-ink/25 to-transparent px-4 pb-5 pt-16 text-center">
              <p className="max-w-full text-lg font-semibold break-words text-white">
                {emptyTitle ??
                  (libraryOnly || emphasis === "library"
                    ? "Pick a photo from your camera roll"
                    : "Take a photo")}
              </p>
              {hint ? <p className="max-w-full text-sm break-words text-white/90">{hint}</p> : null}
            </div>
          )}
        </button>
        {previewUrl ? (
          <SaveToPhotosButton
            src={previewUrl}
            filename="catch-compass-photo.jpg"
            variant="overlay"
          />
        ) : null}
        {busy && previewUrl ? (
          <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-semibold text-white">
            {busyLabel}
          </span>
        ) : busy ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink/40 text-sm font-semibold text-white">
            {busyLabel}
          </div>
        ) : null}
      </div>
      <div className={`grid min-w-0 gap-2 p-3 ${libraryOnly ? "grid-cols-1" : "grid-cols-2"}`}>
        {libraryOnly ? null : (
          <button
            type="button"
            data-testid="live-camera"
            data-no-tab-swipe
            className={`min-w-0 rounded-xl px-3 py-3 text-sm font-semibold ${
              emphasis === "camera" ? "bg-teal text-white" : "border border-line bg-card"
            }`}
            onPointerDown={(event) => {
              if (liveCameraTapAction(locationStatus) === "start-gps" && onTurnLocationOn) {
                startLocationFromThisTap();
                event.preventDefault();
                event.stopPropagation();
              }
            }}
            onClick={openCamera}
          >
            Camera
          </button>
        )}
        <button
          type="button"
          className={`min-w-0 rounded-xl px-3 py-3 text-sm font-semibold ${
            libraryOnly || emphasis === "library" ? "bg-teal text-white" : "border border-line bg-card"
          }`}
          onClick={() => libraryRef.current?.click()}
        >
          Camera roll
        </button>
      </div>
      {showTurnOn ? (
        <div
          className="relative z-20 isolate min-w-0 space-y-2 px-3 pb-3 pointer-events-auto"
          data-no-tab-swipe
          data-testid="turn-location-on-wrap"
        >
          <p data-testid="live-location-reason" className="text-xs break-words whitespace-pre-line text-ink-muted">
            {reasonText}
          </p>
          <button
            type="button"
            data-testid="turn-location-on"
            data-no-tab-swipe
            disabled={waiting}
            onPointerDown={onTurnLocationGesture}
            onClick={onTurnLocationGesture}
            className="relative z-20 w-full max-w-full touch-manipulation pointer-events-auto rounded-xl bg-teal py-3 text-base font-semibold text-white disabled:opacity-60"
          >
            {waiting ? GETTING_LOCATION_LABEL : TURN_LOCATION_ON_LABEL}
          </button>
        </div>
      ) : locationReason ? (
        <p data-testid="live-location-reason" className="px-3 pb-3 text-xs break-words whitespace-pre-line text-ink-muted">
          {locationReason}
        </p>
      ) : null}
      {libraryOnly ? null : (
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file, "camera");
            e.target.value = "";
          }}
        />
      )}
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file, "library");
          e.target.value = "";
        }}
      />
    </div>
  );
}
