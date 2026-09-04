"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import exifr from "exifr";
import { compressImage, photoSrc } from "@/lib/photo";
import { readPhotoGps } from "@/lib/photo-gps";
import { formatCatchWhen, parseExifStamp, PHOTO_EXIF_OPTIONS } from "@/lib/time";
import { localDateKeyFromDate } from "@/lib/calendar";
import {
  asPickedScanItems,
  getScanQueueServerSnapshot,
  isLikelyScanPhoto,
  normalizeScanOrigin,
  peekScanQueue,
  presentScanReview,
  setScanQueue,
  sortScanReviewList,
  subscribeScanQueue,
  type QueuedScanCandidate,
  type ScanBatchOrigin,
} from "@/lib/scan-queue";

type Candidate = {
  id: string;
  photoPath: string;
  caughtAt: Date;
  note: string;
  confidence: number;
  demo: boolean;
  likely: boolean;
  origin: ScanBatchOrigin;
  photoTakenLatitude: number | null;
  photoTakenLongitude: number | null;
};

function toQueued(c: Candidate): QueuedScanCandidate {
  const origin = normalizeScanOrigin(c.origin);
  return {
    photoPath: c.photoPath,
    caughtAtIso: c.caughtAt.toISOString(),
    note: c.note,
    confidence: c.confidence,
    demo: c.demo,
    likely: origin === "picked" ? true : c.likely === true,
    origin,
    photoTakenLatitude: c.photoTakenLatitude,
    photoTakenLongitude: c.photoTakenLongitude,
  };
}

function fromQueued(item: QueuedScanCandidate): Candidate {
  const origin = normalizeScanOrigin(item.origin);
  return {
    id: item.photoPath,
    photoPath: item.photoPath,
    caughtAt: new Date(item.caughtAtIso),
    note: item.note,
    confidence: item.confidence,
    demo: item.demo,
    likely: origin === "picked" ? true : isLikelyScanPhoto(item.likely),
    origin,
    photoTakenLatitude: item.photoTakenLatitude ?? null,
    photoTakenLongitude: item.photoTakenLongitude ?? null,
  };
}

export function ScanLibraryClient() {
  const router = useRouter();
  const photosRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [blobThumbs, setBlobThumbs] = useState<Record<string, string>>({});
  const blobThumbsRef = useRef<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [skipped, setSkipped] = useState(0);
  const queued = useSyncExternalStore(
    subscribeScanQueue,
    peekScanQueue,
    getScanQueueServerSnapshot,
  );
  const candidates = queued.map(fromQueued);
  const { origin: reviewOrigin, likely, unlikely } = presentScanReview(candidates);
  const pickedBatch = reviewOrigin === "picked";
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    folderRef.current?.setAttribute("webkitdirectory", "true");
  }, []);

  useEffect(() => {
    blobThumbsRef.current = blobThumbs;
  }, [blobThumbs]);

  useEffect(() => {
    return () => {
      for (const url of Object.values(blobThumbsRef.current)) URL.revokeObjectURL(url);
    };
  }, []);

  function thumbSrc(photoPath: string): string | null {
    return blobThumbs[photoPath] ?? photoSrc(photoPath);
  }

  function rememberBlob(photoPath: string, file: File) {
    const url = URL.createObjectURL(file);
    setBlobThumbs((current) => {
      const previous = current[photoPath];
      if (previous) URL.revokeObjectURL(previous);
      return { ...current, [photoPath]: url };
    });
  }

  function revokeBlob(photoPath: string) {
    setBlobThumbs((current) => {
      const previous = current[photoPath];
      if (previous) URL.revokeObjectURL(previous);
      const next = { ...current };
      delete next[photoPath];
      return next;
    });
  }

  function revokeAllBlobs() {
    setBlobThumbs((current) => {
      for (const url of Object.values(current)) URL.revokeObjectURL(url);
      return {};
    });
  }

  async function onFiles(list: FileList | null, origin: ScanBatchOrigin) {
    if (!list?.length) return;
    setError(null);
    setBusy(true);
    setSkipped(0);
    revokeAllBlobs();
    setScanQueue([]);
    const files = [...list].filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name));
    const found: Candidate[] = [];
    let skip = 0;
    for (let i = 0; i < files.length; i++) {
      setProgress(`Opening ${i + 1} of ${files.length}…`);
      const original = files[i];
      try {
        let caughtAt = new Date();
        let photoTakenLatitude: number | null = null;
        let photoTakenLongitude: number | null = null;
        try {
          const photoGps = await readPhotoGps(original);
          if (photoGps) {
            photoTakenLatitude = photoGps.latitude;
            photoTakenLongitude = photoGps.longitude;
          }
          const exif = (await exifr.parse(original, PHOTO_EXIF_OPTIONS)) as {
            DateTimeOriginal?: string | Date;
            CreateDate?: string | Date;
          } | undefined;
          const stamp = parseExifStamp(exif?.DateTimeOriginal ?? exif?.CreateDate);
          if (stamp) caughtAt = stamp;
        } catch {
          /* EXIF optional */
        }
        const compressed = await compressImage(original);
        const file = new File([compressed], original.name.replace(/\.\w+$/, ".jpg"), {
          type: "image/jpeg",
        });
        const detection =
          origin === "scan"
            ? await detectFishPhoto(file, original.name)
            : { candidate: true, confidence: 1, demo: false, note: "" };
        const fd = new FormData();
        fd.set("photo", file);
        const up = await fetch("/api/media", { method: "POST", body: fd });
        const data = (await up.json()) as { photoPath?: string; error?: string };
        if (!up.ok || !data.photoPath) throw new Error(data.error || "Photo upload failed");
        rememberBlob(data.photoPath, file);
        found.push({
          id: data.photoPath,
          photoPath: data.photoPath,
          caughtAt,
          note: detection.note,
          confidence: detection.confidence,
          demo: detection.demo,
          likely: origin === "picked" ? true : detection.candidate === true,
          origin,
          photoTakenLatitude,
          photoTakenLongitude,
        });
        commitReviewQueue(found, origin);
      } catch {
        skip += 1;
      }
    }
    setSkipped(skip);
    commitReviewQueue(found, origin);
    setBusy(false);
    setProgress("");
  }

  function commitReviewQueue(found: Candidate[], origin: ScanBatchOrigin) {
    const queuedItems = found.map(toQueued);
    setScanQueue(origin === "picked" ? asPickedScanItems(queuedItems) : sortScanReviewList(queuedItems));
  }

  function dismiss(photoPath: string) {
    revokeBlob(photoPath);
    setScanQueue(queued.filter((c) => c.photoPath !== photoPath));
  }

  function openCandidate(item: Candidate) {
    setAdding(item.id);
    setError(null);
    revokeBlob(item.photoPath);
    setScanQueue(queued.filter((c) => c.photoPath !== item.photoPath));
    const at = item.caughtAt.toISOString();
    const day = localDateKeyFromDate(item.caughtAt);
    const gps =
      item.photoTakenLatitude != null && item.photoTakenLongitude != null
        ? `&plat=${encodeURIComponent(String(item.photoTakenLatitude))}&plon=${encodeURIComponent(String(item.photoTakenLongitude))}`
        : "";
    router.push(
      `/backfill?photo=${encodeURIComponent(item.photoPath)}&at=${encodeURIComponent(at)}&day=${day}&next=calendar${gps}`,
    );
  }

  return (
    <div className="space-y-4">
      <div className="page-intro">
        <h1 className="font-display text-3xl text-teal">Find fish photos</h1>
        <p className="text-sm text-ink-muted">
          Point us at a batch — camera roll, files, or a folder. Photos you pick are yours to log —
          we do not mark them unlikely. A folder scan still puts likely fish first. We read the date
          from the picture when it is there. We cannot scan the whole phone in the background.
          Nothing is added until you confirm.
        </p>
      </div>

      <button
        type="button"
        data-testid="find-fish-photos"
        onClick={() => photosRef.current?.click()}
        disabled={busy}
        className="w-full rounded-2xl bg-copper px-4 py-4 text-lg font-semibold text-white disabled:opacity-60"
      >
        {busy ? progress || "Opening your batch…" : "Pick a batch from this phone"}
      </button>
      <button
        type="button"
        data-testid="find-fish-folder"
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
          void onFiles(e.target.files, "picked");
          e.target.value = "";
        }}
      />
      <input
        ref={folderRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          void onFiles(e.target.files, "scan");
          e.target.value = "";
        }}
      />

      {error ? <p className="on-wash-chip text-sm text-copper">{error}</p> : null}

      {!busy && candidates.length === 0 ? (
        <p className="on-wash-chip text-sm">
          {skipped
            ? `Could not open ${skipped}. Try a different batch.`
            : "Pick a batch. We keep the whole set for you to confirm."}
        </p>
      ) : null}

      {candidates.length ? (
        <div className="space-y-3">
          {likely.length ? (
            <div className="space-y-2" data-testid={pickedBatch ? "scan-picked-section" : undefined}>
              <p className="on-wash-chip w-fit text-sm">
                {pickedBatch
                  ? `${likely.length} photo${likely.length === 1 ? "" : "s"} you picked. Tap one to pin it and finish the trip.`
                  : `${likely.length} likely fish photo${likely.length === 1 ? "" : "s"}. Tap one to pin it and finish the trip.`}
                {skipped ? ` Could not open ${skipped}.` : ""}
              </p>
              {likely.map((item) => (
                <ScanPhotoRow
                  key={item.id}
                  item={item}
                  src={thumbSrc(item.photoPath)}
                  adding={adding}
                  picked={pickedBatch}
                  onOpen={openCandidate}
                  onDismiss={dismiss}
                />
              ))}
            </div>
          ) : null}

          {!pickedBatch && unlikely.length ? (
            likely.length ? (
              <details className="space-y-2" data-testid="scan-unlikely-section">
                <summary className="on-wash-chip w-fit cursor-pointer text-sm font-semibold">
                  Unlikely — still yours to log ({unlikely.length})
                </summary>
                <div className="space-y-2 pt-2">
                  {unlikely.map((item) => (
                    <ScanPhotoRow
                      key={item.id}
                      item={item}
                      src={thumbSrc(item.photoPath)}
                      adding={adding}
                      picked={false}
                      onOpen={openCandidate}
                      onDismiss={dismiss}
                    />
                  ))}
                </div>
              </details>
            ) : (
              <div className="space-y-2" data-testid="scan-unlikely-section">
                <p className="on-wash-chip w-fit text-sm">
                  Unlikely — still yours to log. Tap one to pin it and finish the trip.
                  {skipped ? ` Could not open ${skipped}.` : ""}
                </p>
                {unlikely.map((item) => (
                  <ScanPhotoRow
                    key={item.id}
                    item={item}
                    src={thumbSrc(item.photoPath)}
                    adding={adding}
                    picked={false}
                    onOpen={openCandidate}
                    onDismiss={dismiss}
                  />
                ))}
              </div>
            )
          ) : null}
        </div>
      ) : null}

      <p className="on-wash-chip text-xs">
        Privacy: only the batch you pick is checked. We do not read the rest of the camera roll.
        Dates come from the photo when EXIF is there. Nothing is added until you finish the trip form.
      </p>
    </div>
  );
}

function ScanPhotoRow({
  item,
  src,
  adding,
  picked,
  onOpen,
  onDismiss,
}: {
  item: Candidate;
  src: string | null;
  adding: string | null;
  picked: boolean;
  onOpen: (item: Candidate) => void;
  onDismiss: (photoPath: string) => void;
}) {
  const title = adding === item.id
    ? "Opening trip…"
    : picked
      ? "Catch photo"
      : item.likely
        ? "Likely fish photo"
        : "Unlikely — still yours to log";
  return (
    <div
      className="journal-card relative flex overflow-hidden rounded-2xl"
      data-testid="scan-photo-row"
      data-likely={picked || item.likely ? "true" : "false"}
      data-origin={picked ? "picked" : "scan"}
    >
      <button
        type="button"
        disabled={adding !== null}
        onClick={() => onOpen(item)}
        className="flex min-w-0 flex-1 text-left disabled:opacity-60"
      >
        <div className="h-24 w-24 shrink-0 bg-paper-deep">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-ink-muted">Photo</div>
          )}
        </div>
        <div className="min-w-0 flex-1 px-3 py-2">
          <p className="truncate font-semibold text-ink">{title}</p>
          <p className="truncate text-sm text-ink-muted">
            {formatCatchWhen(item.caughtAt.toISOString())}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
            {picked ? null : (
              <span
                data-testid="scan-photo-badge"
                className={`rounded-full px-2 py-0.5 font-semibold ${
                  item.likely ? "bg-teal/15 text-teal" : "border border-line"
                }`}
              >
                {item.likely ? "Likely fish" : "Unlikely"}
              </span>
            )}
            <span>Tap to backfill this photo.</span>
          </p>
        </div>
      </button>
      <button
        type="button"
        disabled={adding !== null}
        onClick={() => onDismiss(item.photoPath)}
        className="shrink-0 px-3 text-xs font-semibold text-ink-muted"
      >
        Skip
      </button>
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
