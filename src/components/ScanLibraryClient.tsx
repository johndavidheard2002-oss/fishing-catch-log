"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import exifr from "exifr";
import { compressImage } from "@/lib/photo";
import { dateFromDatetimeLocal, datetimeLocalValue, parseExifStamp } from "@/lib/time";
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
    setCandidates([]);
    setIndex(0);
    setScanQueue([]);
    const files = [...list].filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name));
    const found: Candidate[] = [];
    let skip = 0;
    for (let i = 0; i < files.length; i++) {
      setProgress(`Opening ${i + 1} of ${files.length}…`);
      const original = files[i];
      try {
        const compressed = await compressImage(original);
        const file = new File([compressed], original.name.replace(/\.\w+$/, ".jpg"), {
          type: "image/jpeg",
        });
        let caughtAt = new Date();
        let photoTakenLatitude: number | null = null;
        let photoTakenLongitude: number | null = null;
        try {
          const exif = (await exifr.parse(original, {
            gps: true,
            pick: ["DateTimeOriginal", "CreateDate", "latitude", "longitude"],
          })) as {
            DateTimeOriginal?: Date;
            CreateDate?: Date;
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
          note: "",
          confidence: 0,
          demo: false,
          photoTakenLatitude,
          photoTakenLongitude,
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
      <div>
        <h1 className="font-display text-3xl text-teal">Find fishing photos in your library</h1>
        <p className="text-sm text-ink-muted">
          Included with every Catch Compass journal. Choose pictures from this phone, then confirm
          each one onto your calendar at the photo&apos;s time. You pick the species. Only your
          photos — not anyone else&apos;s roll, and never a public share.
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
          Your photos
        </span>
      </div>

      <button
        type="button"
        onClick={() => photosRef.current?.click()}
        disabled={busy}
        className="w-full rounded-2xl bg-copper px-4 py-4 text-lg font-semibold text-white disabled:opacity-60"
      >
        {busy ? progress || "Checking photos…" : "Choose photos from this phone"}
      </button>
      <button
        type="button"
        onClick={() => folderRef.current?.click()}
        disabled={busy}
        className="w-full rounded-2xl border border-line bg-card px-4 py-3 font-semibold disabled:opacity-60"
      >
        Choose a folder on this device
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

      {error ? <p className="text-sm text-copper">{error}</p> : null}

      {!busy && !current && (skipped > 0 || candidates.length === 0) ? (
        <p className="text-sm text-ink-muted">
          {skipped
            ? `Skipped ${skipped} file${skipped === 1 ? "" : "s"} we could not open.`
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
              Photo {index + 1} of {candidates.length}
            </p>
            <label className="block">
              <span className="mb-1 block text-xs text-ink-muted">Catch date and time</span>
              <input
                type="datetime-local"
                value={datetimeLocalValue(current.caughtAt.toISOString())}
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
              save, History opens on that day.
            </p>
          </div>
        </article>
      ) : null}

      <p className="text-xs text-ink-muted">
        Privacy: this is your journal on this phone. Only the pictures you pick are checked. They
        stay in your Catch Compass log. Nothing is added until you tap Yes. We do not look at the
        rest of your camera roll.
      </p>
      <Link href="/backfill" className="inline-block text-sm font-semibold text-teal">
        Backfill one photo instead
      </Link>
    </div>
  );
}
