"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import exifr from "exifr";
import { compressImage } from "@/lib/photo";
import { formatCatchWhen, parseExifStamp, PHOTO_EXIF_OPTIONS } from "@/lib/time";
import { localDateKeyFromDate } from "@/lib/calendar";
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
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

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

  function dismiss(i: number) {
    setCandidates((list) => {
      const gone = list[i];
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      return list.filter((_, j) => j !== i);
    });
  }

  async function openCandidate(item: Candidate) {
    setAdding(item.id);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("photo", item.file);
      const up = await fetch("/api/media", { method: "POST", body: fd });
      const data = await up.json();
      if (!up.ok) throw new Error(data.error || "Photo upload failed");
      const at = item.caughtAt.toISOString();
      const day = localDateKeyFromDate(item.caughtAt);
      const remaining = candidates.filter((c) => c.id !== item.id);
      setScanQueue(remaining.map(toQueued));
      remaining.forEach((c) => URL.revokeObjectURL(c.previewUrl));
      URL.revokeObjectURL(item.previewUrl);
      const gps =
        item.photoTakenLatitude != null && item.photoTakenLongitude != null
          ? `&plat=${encodeURIComponent(String(item.photoTakenLatitude))}&plon=${encodeURIComponent(String(item.photoTakenLongitude))}`
          : "";
      router.push(
        `/backfill?photo=${encodeURIComponent(data.photoPath)}&at=${encodeURIComponent(at)}&day=${day}&next=calendar${gps}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that photo");
      setAdding(null);
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

      {!busy && candidates.length === 0 ? (
        <p className="on-wash-chip text-sm">
          {filteredOut || skipped
            ? [
                filteredOut
                  ? `Set aside ${filteredOut} that did not look like a catch.`
                  : null,
                skipped ? `Could not open ${skipped}.` : null,
                "None of that batch looked like a fish photo. Try a set that includes trip pictures.",
              ]
                .filter(Boolean)
                .join(" ")
            : "Pick a batch. We only look at what you select."}
        </p>
      ) : null}

      {candidates.length ? (
        <div className="space-y-2">
          <p className="on-wash-chip w-fit text-sm">
            {candidates.length} likely fish photo{candidates.length === 1 ? "" : "s"}. Tap one to
            finish it the same way as One trip — photo, date, pin, and fields.
            {heuristic ? " Fish pick is a heuristic unless vision is on." : ""}
          </p>
          {candidates.map((item, i) => (
            <div
              key={item.id}
              className="journal-card relative flex overflow-hidden rounded-2xl"
              data-testid="scan-photo-row"
            >
              <button
                type="button"
                disabled={adding !== null}
                onClick={() => void openCandidate(item)}
                className="flex min-w-0 flex-1 text-left disabled:opacity-60"
              >
                <div className="h-24 w-24 shrink-0 bg-paper-deep">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1 px-3 py-2">
                  <p className="truncate font-semibold text-ink">
                    {adding === item.id ? "Opening trip…" : "Likely fish photo"}
                  </p>
                  <p className="truncate text-sm text-ink-muted">
                    {formatCatchWhen(item.caughtAt.toISOString())}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Tap for the same trip form — date, pin, and fields.
                  </p>
                </div>
              </button>
              <button
                type="button"
                disabled={adding !== null}
                onClick={() => dismiss(i)}
                className="shrink-0 px-3 text-xs font-semibold text-ink-muted"
              >
                Skip
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <p className="on-wash-chip text-xs">
        Privacy: only the batch you pick is checked. We do not read the rest of the camera roll.
        Dates come from the photo when EXIF is there. Nothing is added until you finish the trip form.
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
