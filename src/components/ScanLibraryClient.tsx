"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import exifr from "exifr";
import { compressImage } from "@/lib/photo";
import { dateFromDatetimeLocal, datetimeLocalFromDate, parseExifStamp, PHOTO_EXIF_OPTIONS } from "@/lib/time";
import { localDateKeyFromDate } from "@/lib/calendar";
import { formatCoords } from "@/lib/location";
import { peekScanQueue, setScanQueue, type QueuedScanCandidate } from "@/lib/scan-queue";

type Candidate = {
  id: string;
  file: File;
  previewUrl: string;
  caughtAt: Date;
  note: string;
  confidence: number;
  demo: boolean;
  photoTakenLatitude: number | null;
  photoTakenLongitude: number | null;
};

function toQueued(c: Candidate): QueuedScanCandidate {
  return {
    file: c.file,
    caughtAtIso: c.caughtAt.toISOString(),
    note: c.note,
    confidence: c.confidence,
    demo: c.demo,
    photoTakenLatitude: c.photoTakenLatitude,
    photoTakenLongitude: c.photoTakenLongitude,
  };
}

function fromQueued(item: QueuedScanCandidate, i: number): Candidate {
  return {
    id: `queued-${i}-${item.file.name}`,
    file: item.file,
    previewUrl: URL.createObjectURL(item.file),
    caughtAt: new Date(item.caughtAtIso),
    note: item.note,
    confidence: item.confidence,
    demo: item.demo,
    photoTakenLatitude: item.photoTakenLatitude ?? null,
    photoTakenLongitude: item.photoTakenLongitude ?? null,
  };
}

export function ScanLibraryClient() {
  const router = useRouter();
  const photosRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [skipped, setSkipped] = useState(0);
  const [filteredOut, setFilteredOut] = useState(0);
  const [heuristic, setHeuristic] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>(() => {
    const leftover = peekScanQueue();
    setScanQueue([]);
    return leftover.map(fromQueued);
  });
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    folderRef.current?.setAttribute("webkitdirectory", "true");
  }, []);

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    setBusy(true);
    setSkipped(0);
    setFilteredOut(0);
    setHeuristic(false);
    setCandidates([]);
    setIndex(0);
    setScanQueue([]);
    const files = [...list].filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name));
    const found: Candidate[] = [];
    let skip = 0;
    let notFish = 0;
    let usedHeuristic = false;
    for (let i = 0; i < files.length; i++) {
      setProgress(`Looking for fish in ${i + 1} of ${files.length}…`);
      const original = files[i];
      try {
        const compressed = await compressImage(original);
        const file = new File([compressed], original.name.replace(/\.\w+$/, ".jpg"), {
          type: "image/jpeg",
        });
        const detection = await detectFishPhoto(file, original.name);
        if (detection.demo) usedHeuristic = true;
        if (!detection.candidate) {
          notFish += 1;
          continue;
        }
        let caughtAt = new Date();
        let photoTakenLatitude: number | null = null;
        let photoTakenLongitude: number | null = null;
        try {
          const exif = (await exifr.parse(original, PHOTO_EXIF_OPTIONS)) as {
            DateTimeOriginal?: string | Date;
            CreateDate?: string | Date;
            latitude?: number;
            longitude?: number;
          } | undefined;
          const stamp = parseExifStamp(exif?.DateTimeOriginal ?? exif?.CreateDate);
          if (stamp) caughtAt = stamp;
          if (exif?.latitude != null && exif.longitude != null) {
            photoTakenLatitude = exif.latitude;
            photoTakenLongitude = exif.longitude;
          }
        } catch {
          /* EXIF optional */
        }
        found.push({
          id: `${original.name}-${i}`,
          file,
          previewUrl: URL.createObjectURL(file),
          caughtAt,
          note: detection.note,
          confidence: detection.confidence,
          demo: detection.demo,
          photoTakenLatitude,
          photoTakenLongitude,
        });
      } catch {
        skip += 1;
      }
    }
    setSkipped(skip);
    setFilteredOut(notFish);
    setHeuristic(usedHeuristic);
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
      setScanQueue([]);
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
      const remaining = candidates.slice(index + 1);
      setScanQueue(remaining.map(toQueued));
      remaining.forEach((c) => URL.revokeObjectURL(c.previewUrl));
      URL.revokeObjectURL(current.previewUrl);
      const gps =
        current.photoTakenLatitude != null && current.photoTakenLongitude != null
          ? `&plat=${encodeURIComponent(String(current.photoTakenLatitude))}&plon=${encodeURIComponent(String(current.photoTakenLongitude))}`
          : "";
      router.push(
        `/backfill?photo=${encodeURIComponent(data.photoPath)}&at=${encodeURIComponent(at)}&day=${day}&next=calendar${gps}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that photo");
      setAdding(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="page-intro">
        <h1 className="font-display text-3xl text-teal">Find fish photos</h1>
        <p className="text-sm text-ink-muted">
          Point us at a batch — camera roll, files, or a folder. We pick out likely fish photos and
          read the date from the picture when it is there. We cannot scan the whole phone in the
          background. Nothing is added until you confirm.
        </p>
      </div>
      <div className="journal-card grid grid-cols-2 overflow-hidden rounded-2xl p-1">
        <Link
          href="/backfill"
          className="rounded-xl py-2 text-center text-xs font-semibold text-ink-muted"
        >
          One trip
        </Link>
        <span className="rounded-xl bg-teal py-2 text-center text-xs font-semibold text-white">
          Find fish photos
        </span>
      </div>

      <button
        type="button"
        data-testid="find-fish-photos"
        onClick={() => photosRef.current?.click()}
        disabled={busy}
        className="w-full rounded-2xl bg-copper px-4 py-4 text-lg font-semibold text-white disabled:opacity-60"
      >
        {busy ? progress || "Looking for fish…" : "Pick a batch from this phone"}
      </button>
      <button
        type="button"
        onClick={() => folderRef.current?.click()}
        disabled={busy}
        className="w-full rounded-2xl border border-line bg-card px-4 py-3 font-semibold disabled:opacity-60"
      >
        Pick a folder on this device
      </button>
      <input
        ref={photosRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={folderRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          void onFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {error ? <p className="on-wash-chip text-sm text-copper">{error}</p> : null}

      {!busy && !current ? (
        <p className="on-wash-chip text-sm">
          {filteredOut || skipped
            ? [
                filteredOut
                  ? `Set aside ${filteredOut} that did not look like a catch.`
                  : null,
                skipped ? `Could not open ${skipped}.` : null,
                candidates.length === 0
                  ? "None of that batch looked like a fish photo. Try a set that includes trip pictures."
                  : null,
              ]
                .filter(Boolean)
                .join(" ")
            : "Pick a batch. We only look at what you select."}
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
              Likely fish {index + 1} of {candidates.length}
            </p>
            {current.note ? (
              <p className="text-xs text-ink-muted">{current.note}</p>
            ) : null}
            {current.demo || heuristic ? (
              <p className="text-xs text-ink-muted">
                Fish pick is a heuristic unless vision is on — confirm before adding.
              </p>
            ) : null}
            <label className="block">
              <span className="mb-1 block text-xs text-ink-muted">Catch date and time</span>
              <input
                type="datetime-local"
                value={datetimeLocalFromDate(current.caughtAt)}
                onChange={(e) => {
                  const next = dateFromDatetimeLocal(e.target.value);
                  if (!next) return;
                  setCandidates((list) =>
                    list.map((c, i) => (i === index ? { ...c, caughtAt: next } : c)),
                  );
                }}
                className="w-full rounded-xl border border-line bg-card px-3 py-3"
              />
            </label>
            <p className="text-xs text-ink-muted">
              Uses the time saved in the photo when it is there. Edit if the camera clock was wrong.
            </p>
            <p className="text-xs text-ink-muted">
              {current.photoTakenLatitude != null && current.photoTakenLongitude != null
                ? `Location stamp ${formatCoords(current.photoTakenLatitude, current.photoTakenLongitude)}. Yes drops a movable catch pin there — drag it if the picture was not taken on the water.`
                : "No GPS in this photo — you’ll place the pin on the map. We will not use your current location for a past catch."}
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
              Yes opens the past-catch form with this photo, timestamp, and this photo’s GPS when it
              has one. You can still move the pin. Remaining photos keep their own locations. After
              save, Calendar Log opens on that day.
            </p>
          </div>
        </article>
      ) : null}

      <p className="on-wash-chip text-xs">
        Privacy: only the batch you pick is checked. We do not read the rest of the camera roll.
        Dates come from the photo when EXIF is there. Nothing is added until you tap Yes.
      </p>
      <Link href="/backfill" className="on-wash-chip inline-block text-sm font-semibold text-teal">
        Backfill one photo instead
      </Link>
    </div>
  );
}

async function detectFishPhoto(
  file: File,
  fileName: string,
): Promise<{ candidate: boolean; confidence: number; demo: boolean; note: string }> {
  try {
    const fd = new FormData();
    fd.set("photo", file);
    fd.set("fileName", fileName);
    const res = await fetch("/api/assist/detect-fish", { method: "POST", body: fd });
    const data = (await res.json()) as {
      candidate?: boolean;
      detection?: { confidence?: number; source?: string; note?: string };
    };
    return {
      candidate: Boolean(data.candidate),
      confidence: data.detection?.confidence ?? 0,
      demo: data.detection?.source === "demo",
      note: data.detection?.note ?? "",
    };
  } catch {
    return {
      candidate: true,
      confidence: 0,
      demo: true,
      note: "Could not scan this file. Confirm it is a fish before adding.",
    };
  }
}
