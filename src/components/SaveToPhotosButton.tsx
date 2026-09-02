"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { savePhotoHint, savePhotoToDevice, type SavePhotoResult } from "@/lib/save-photo";

export function SaveToPhotosButton({
  src,
  filename,
  variant = "button",
  className = "",
}: {
  src: string;
  filename: string;
  variant?: "button" | "overlay" | "text";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hint && !error) return;
    const t = window.setTimeout(() => {
      setHint(null);
      setError(null);
    }, 8000);
    return () => window.clearTimeout(t);
  }, [hint, error]);

  async function onSave(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      const result: SavePhotoResult = await savePhotoToDevice(src, filename);
      const next = savePhotoHint(result);
      if (next) setHint(next);
    } catch {
      setError("Could not save this photo. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const label = busy ? "Saving…" : "Save to Photos";

  if (variant === "overlay") {
    return (
      <div className={`absolute left-1.5 top-1.5 z-10 ${className}`}>
        <button
          type="button"
          onClick={onSave}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Save photo to this phone"
          title="Save to Photos"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/70 text-white shadow"
        >
          <DownloadIcon />
        </button>
        {hint || error ? (
          <p className="mt-1 max-w-[10rem] rounded-md bg-ink/80 px-1.5 py-1 text-[10px] leading-tight text-white">
            {error ?? hint}
          </p>
        ) : null}
      </div>
    );
  }

  if (variant === "text") {
    return (
      <span className={className}>
        <button type="button" onClick={onSave} className="text-sm font-semibold text-teal">
          {label}
        </button>
        {hint || error ? (
          <p className="mt-1 text-xs text-ink-muted">{error ?? hint}</p>
        ) : null}
      </span>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onSave}
        className="w-full rounded-xl border border-line bg-card py-3 font-semibold"
      >
        {label}
      </button>
      {hint || error ? (
        <p className="mt-1.5 text-xs text-ink-muted">{error ?? hint}</p>
      ) : null}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
