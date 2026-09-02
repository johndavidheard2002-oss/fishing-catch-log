"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import exifr from "exifr";
import { compressImage } from "@/lib/photo";
import { datetimeLocalValue, formatCaughtAt } from "@/lib/time";
import { localDateKeyFromDate } from "@/lib/calendar";

type Candidate = {
  id: string;
  file: File;
  previewUrl: string;
  caughtAt: Date;
  note: string;
  confidence: number;
  demo: boolean;
};

export function ScanLibraryClient() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [skipped, setSkipped] = useState(0);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    setBusy(true);
    setSkipped(0);
    setCandidates([]);
    setIndex(0);
    const files = [...list];
    const found: Candidate[] = [];
    let skip = 0;
    for (let i = 0; i < files.length; i++) {
      setProgress(`Checking ${i + 1} of ${files.length}…`);
      const original = files[i];
      const compressed = await compressImage(original);
      const file = new File([compressed], original.name.replace(/\.\w+$/, ".jpg"), {
        type: "image/jpeg",
      });
      let caughtAt = new Date();
      try {
        const exif = (await exifr.parse(original, {
          pick: ["DateTimeOriginal", "CreateDate"],
        })) as { DateTimeOriginal?: Date; CreateDate?: Date } | undefined;
        const stamp = exif?.DateTimeOriginal ?? exif?.CreateDate;
        if (stamp instanceof Date && !Number.isNaN(stamp.getTime())) caughtAt = stamp;
      } catch {
        /* EXIF optional */
      }
      try {
        const fd = new FormData();
        fd.set("photo", file);
        const res = await fetch("/api/assist/detect-fish", { method: "POST", body: fd });
        const data = (await res.json()) as {
          candidate?: boolean;
          detection?: { note?: string; confidence?: number; source?: string };
        };
        if (!data.candidate) {
          skip += 1;
          continue;
        }
        found.push({
          id: `${original.name}-${i}`,
          file,
          previewUrl: URL.createObjectURL(file),
          caughtAt,
          note: data.detection?.note ?? "",
          confidence: data.detection?.confidence ?? 0,
          demo: data.detection?.source === "demo",
        });
      } catch {
        skip += 1;
      }
    }
    setSkipped(skip);
    setCandidates(found);
    setBusy(false);
    setProgress("");
  }

  const current = candidates[index];

  function skipOne() {
    if (current) URL.revokeObjectURL(current.previewUrl);
    if (index + 1 >= candidates.length) {
      setCandidates([]);
      setIndex(0);
      return;
    }
    setIndex((i) => i + 1);
  }

  async function addCurrent() {
    if (!current) return;
    setAdding(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("photo", current.file);
      const up = await fetch("/api/media", { method: "POST", body: fd });
      const data = await up.json();
      if (!up.ok) throw new Error(data.error || "Photo upload failed");
      const at = current.caughtAt.toISOString();
      const day = localDateKeyFromDate(current.caughtAt);
      URL.revokeObjectURL(current.previewUrl);
      router.push(
        `/log?past=1&photo=${encodeURIComponent(data.photoPath)}&at=${encodeURIComponent(at)}&day=${day}&next=calendar`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that photo");
      setAdding(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-teal">Find fishing photos in your library</h1>
        <p className="text-sm text-ink-muted">
          Import old trips from this phone. You choose the pictures — Catch Compass does not browse
          the rest of your library or anyone else&apos;s. We look for fish in what you picked, then
          ask before anything is added. A later native app can offer a full-library scan; in the
          browser you grant photos one batch at a time.
        </p>
      </div>
      <div className="journal-card grid grid-cols-3 overflow-hidden rounded-2xl p-1">
        <Link href="/log" className="rounded-xl py-2 text-center text-xs font-semibold text-ink-muted">
          Now
        </Link>
        <Link
          href="/log?past=1"
          className="rounded-xl py-2 text-center text-xs font-semibold text-ink-muted"
        >
          Backfill
        </Link>
        <span className="rounded-xl bg-teal py-2 text-center text-xs font-semibold text-white">
          Library
        </span>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="w-full rounded-2xl bg-copper px-4 py-4 text-lg font-semibold text-white disabled:opacity-60"
      >
        {busy ? progress || "Checking photos…" : "Choose photos from this phone"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void onFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {error ? <p className="text-sm text-copper">{error}</p> : null}

      {!busy && !current && (skipped > 0 || candidates.length === 0) ? (
        <p className="text-sm text-ink-muted">
          {skipped
            ? `Skipped ${skipped} photo${skipped === 1 ? "" : "s"} that did not look like fish.`
            : "Pick a handful of trip photos. We only look at what you select."}
        </p>
      ) : null}

      {current ? (
        <article className="journal-card overflow-hidden rounded-3xl">
          <div className="aspect-[4/3] bg-paper-deep">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.previewUrl} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="space-y-2 p-4">
            <p className="text-sm font-semibold">
              Candidate {index + 1} of {candidates.length}
            </p>
            <p className="text-sm text-ink-muted">
              Photo time: {formatCaughtAt(current.caughtAt.toISOString())} (
              {datetimeLocalValue(current.caughtAt.toISOString()).replace("T", " ")})
            </p>
            <p className="text-xs text-ink-muted">
              {Math.round(current.confidence * 100)}% · {current.note}
              {current.demo ? " · demo" : ""}
            </p>
            <p className="text-sm font-semibold">Add this to the log?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={adding}
                onClick={() => void addCurrent()}
                className="rounded-xl bg-teal py-3 font-semibold text-white disabled:opacity-60"
              >
                {adding ? "Opening…" : "Yes, add"}
              </button>
              <button
                type="button"
                disabled={adding}
                onClick={skipOne}
                className="rounded-xl border border-line py-3 font-semibold"
              >
                Skip
              </button>
            </div>
            <p className="text-xs text-ink-muted">
              Yes opens the past-catch form with this photo and timestamp. You still pin the water
              and tag species. After save, History opens on that day.
            </p>
          </div>
        </article>
      ) : null}

      <p className="text-xs text-ink-muted">
        Privacy: only photos you select on this device are sent for fish detection. They belong to
        your journal. Nothing is added until you tap Yes.
      </p>
      <Link href="/log?past=1" className="inline-block text-sm font-semibold text-teal">
        Backfill one photo instead
      </Link>
    </div>
  );
}
