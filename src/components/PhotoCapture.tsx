"use client";

import { useRef, useState } from "react";
import { SaveToPhotosButton } from "@/components/SaveToPhotosButton";
import { awaitLiveLocationThenOpenCamera } from "@/lib/location";

export type PhotoSource = "camera" | "library";

export function PhotoCapture({
  previewUrl,
  onFile,
  onLiveCapture,
  busy,
  emphasis = "camera",
  emptyTitle,
  emptyHint,
  compactPreview = false,
  libraryOnly = false,
  locationReason,
}: {
  previewUrl: string | null;
  onFile: (file: File, source: PhotoSource) => void;
  onLiveCapture?: () => void | Promise<unknown>;
  busy?: boolean;
  emphasis?: "camera" | "library";
  emptyTitle?: string;
  emptyHint?: string;
  compactPreview?: boolean;
  libraryOnly?: boolean;
  locationReason?: string;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const openingRef = useRef(false);
  const locationAskedRef = useRef(false);
  const [locating, setLocating] = useState(false);

  function openCamera() {
    if (openingRef.current) return;
    const alreadyAsked = !onLiveCapture || locationAskedRef.current;
    if (alreadyAsked) {
      cameraRef.current?.click();
      return;
    }
    openingRef.current = true;
    setLocating(true);
    void awaitLiveLocationThenOpenCamera({
      requestLocation: onLiveCapture,
      openCamera: () => cameraRef.current?.click(),
    }).finally(() => {
      locationAskedRef.current = true;
      setLocating(false);
      openingRef.current = false;
    });
  }

  const pick = () => {
    if (libraryOnly) libraryRef.current?.click();
    else openCamera();
  };
  const hint =
    emptyHint === undefined
      ? libraryOnly || emphasis === "library"
        ? "Pick an old catch photo from your camera roll. We’ll ask if it was taken where you caught the fish before dropping a pin."
        : "Camera first. This phone’s location pins the catch — allow it when asked."
      : emptyHint;

  return (
    <div
      className="journal-card overflow-hidden rounded-3xl"
      data-testid={libraryOnly && previewUrl ? "backfill-photo" : undefined}
    >
      <div
        className={`relative w-full ${
          previewUrl ? "bg-paper-deep" : "photo-capture-brand"
        } ${compactPreview && previewUrl ? "h-40" : "aspect-[4/3]"}`}
        data-testid={previewUrl ? undefined : "photo-capture-brand"}
      >
        <button
          type="button"
          onClick={pick}
          disabled={locating}
          className="block h-full w-full"
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Catch photo" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-end gap-2 bg-gradient-to-t from-ink/75 via-ink/25 to-transparent px-6 pb-5 pt-16 text-center">
              <p className="text-lg font-semibold text-white">
                {emptyTitle ??
                  (libraryOnly || emphasis === "library"
                    ? "Pick a photo from your camera roll"
                    : "Take a photo")}
              </p>
              {hint ? <p className="text-sm text-white/90">{hint}</p> : null}
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
        {locating ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink/40 text-sm font-semibold text-white">
            Getting location…
          </div>
        ) : busy && previewUrl ? (
          <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-semibold text-white">
            Reading the photo…
          </span>
        ) : busy ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink/40 text-sm font-semibold text-white">
            Reading the photo…
          </div>
        ) : null}
      </div>
      <div className={`grid gap-2 p-3 ${libraryOnly ? "grid-cols-1" : "grid-cols-2"}`}>
        {libraryOnly ? null : (
          <button
            type="button"
            data-testid="live-camera"
            disabled={locating}
            className={`rounded-xl px-3 py-3 text-sm font-semibold ${
              emphasis === "camera" ? "bg-teal text-white" : "border border-line bg-card"
            }`}
            onClick={openCamera}
          >
            {locating ? "Locating…" : "Camera"}
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
      {locationReason ? (
        <p data-testid="live-location-reason" className="px-3 pb-3 text-xs text-ink-muted">
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
