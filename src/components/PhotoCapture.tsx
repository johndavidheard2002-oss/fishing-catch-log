"use client";

import { useRef } from "react";

export function PhotoCapture({
  previewUrl,
  onFile,
  busy,
  emphasis = "camera",
}: {
  previewUrl: string | null;
  onFile: (file: File) => void;
  busy?: boolean;
  emphasis?: "camera" | "library";
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  return (
    <div className="journal-card overflow-hidden rounded-3xl">
      <button
        type="button"
        onClick={() => cameraRef.current?.click()}
        className="relative block aspect-[4/3] w-full bg-paper-deep"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Catch photo" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-teal text-white">
              <CameraIcon />
            </span>
            <p className="text-lg font-semibold">
              {emphasis === "library" ? "Add a photo from your roll" : "Take a photo"}
            </p>
            <p className="text-sm text-ink-muted">
              {emphasis === "library"
                ? "Upload an old catch photo, then set the date and pin the spot."
                : "Camera first. We\u2019ll try species, weather, and GPS next."}
            </p>
          </div>
        )}
        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/40 text-sm font-semibold text-white">
            Reading the catch…
          </div>
        ) : null}
      </button>
      <div className="grid grid-cols-2 gap-2 p-3">
        <button
          type="button"
          className={`rounded-xl px-3 py-3 text-sm font-semibold ${
            emphasis === "camera" ? "bg-teal text-white" : "border border-line bg-card"
          }`}
          onClick={() => cameraRef.current?.click()}
        >
          Camera
        </button>
        <button
          type="button"
          className={`rounded-xl px-3 py-3 text-sm font-semibold ${
            emphasis === "library" ? "bg-teal text-white" : "border border-line bg-card"
          }`}
          onClick={() => libraryRef.current?.click()}
        >
          Camera roll
        </button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 8 9.2 6.2A1 1 0 0 1 10 6h4a1 1 0 0 1 .8.4L16 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h3Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
