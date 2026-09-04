"use client";

import { useRef } from "react";
import { SaveToPhotosButton } from "@/components/SaveToPhotosButton";
import {
  GETTING_LOCATION_LABEL,
  TURN_LOCATION_ON_LABEL,
  logLocationReason,
  shouldShowTurnLocationOn,
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
  onTurnLocationOn?: () => void;
  onLiveCamera?: () => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  function openCamera() {
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

  const showTurnOn =
    Boolean(onTurnLocationOn) && locationStatus != null && shouldShowTurnLocationOn(locationStatus);
  const waiting = locationStatus === "asking";

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
      <div className={`grid gap-2 p-3 ${libraryOnly ? "grid-cols-1" : "grid-cols-2"}`}>
        {libraryOnly ? null : (
          <button
            type="button"
            data-testid="live-camera"
            className={`rounded-xl px-3 py-3 text-sm font-semibold ${
              emphasis === "camera" ? "bg-teal text-white" : "border border-line bg-card"
            }`}
            onClick={openCamera}
          >
            Camera
          </button>
        )}
        <button
          type="button"
          className={`rounded-xl px-3 py-3 text-sm font-semibold ${
            libraryOnly || emphasis === "library" ? "bg-teal text-white" : "border border-line bg-card"
          }`}
          onClick={() => libraryRef.current?.click()}
        >
          Camera roll
        </button>
      </div>
      {showTurnOn ? (
        <div className="min-w-0 space-y-2 px-3 pb-3">
          <p data-testid="live-location-reason" className="text-xs break-words text-ink-muted">
            {waiting ? GETTING_LOCATION_LABEL : logLocationReason(locationStatus ?? "prompt")}
          </p>
          <button
            type="button"
            data-testid="turn-location-on"
            disabled={waiting}
            onClick={onTurnLocationOn}
            className="w-full max-w-full rounded-xl bg-teal py-3 text-base font-semibold text-white disabled:opacity-60"
          >
            {waiting ? GETTING_LOCATION_LABEL : TURN_LOCATION_ON_LABEL}
          </button>
        </div>
      ) : locationReason ? (
        <p data-testid="live-location-reason" className="px-3 pb-3 text-xs break-words text-ink-muted">
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
