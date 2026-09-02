/** Client-only helpers to put a catch photo in the device library. */

export type SavePhotoResult = "shared" | "downloaded" | "opened" | "cancelled";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function mimeFromName(filename: string, fallback = "image/jpeg"): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? fallback;
}

function canShareFiles(file: File): boolean {
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  if (typeof nav.share !== "function" || typeof nav.canShare !== "function") return false;
  try {
    return nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

async function blobFromSrc(src: string): Promise<Blob> {
  const res = await fetch(src);
  if (!res.ok) throw new Error("Could not load the photo.");
  return res.blob();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Best-effort save to the phone library:
 * 1. Web Share with a file (iOS/Android share sheet often includes Save Image / Photos)
 * 2. Browser download
 * 3. On iPhone without file-share, open the image so the angler can long-press Save
 */
export async function savePhotoToDevice(src: string, filename: string): Promise<SavePhotoResult> {
  const blob = await blobFromSrc(src);
  const type = blob.type && blob.type !== "application/octet-stream" ? blob.type : mimeFromName(filename);
  const file = new File([blob], filename, { type });

  if (canShareFiles(file)) {
    try {
      await navigator.share({
        files: [file],
        title: "Catch Compass photo",
        text: "Save this catch photo to your library.",
      });
      return "shared";
    } catch (err) {
      if (isAbort(err)) return "cancelled";
    }
  }

  if (isIosDevice()) {
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, "_blank", "noopener");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    if (!opened) {
      triggerDownload(blob, filename);
      return "downloaded";
    }
    return "opened";
  }

  triggerDownload(blob, filename);
  return "downloaded";
}

export function savePhotoHint(result: SavePhotoResult): string | null {
  switch (result) {
    case "shared":
      return "Pick Save Image or Add to Photos in the share sheet.";
    case "downloaded":
      return isIosDevice()
        ? "If it did not land in Photos, long-press the picture and choose Save to Photos."
        : "Saved to Downloads. Open it there to add it to your gallery if needed.";
    case "opened":
      return "Long-press the photo, then Save to Photos.";
    default:
      return null;
  }
}
