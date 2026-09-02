"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { markHelpTipSeen } from "@/lib/help";
import { markSetupSeen, SETUP_OPEN_EVENT, setupSeen, subscribeSetup } from "@/lib/setup";

export function FirstRunSetup() {
  const router = useRouter();
  const seen = useSyncExternalStore(subscribeSetup, setupSeen, () => true);
  const [forced, setForced] = useState(false);

  useEffect(() => {
    function onOpen() {
      setForced(true);
    }
    window.addEventListener(SETUP_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(SETUP_OPEN_EVENT, onOpen);
  }, []);

  if (seen && !forced) return null;

  function finish() {
    markSetupSeen();
    markHelpTipSeen();
    setForced(false);
  }

  function goPhotos() {
    finish();
    router.push("/log/scan");
  }

  function goOne() {
    finish();
    router.push("/backfill");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-3 pb-6 pt-8 sm:items-center"
      data-no-tab-swipe
      data-testid="first-run-setup"
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-run-title"
    >
      <div className="journal-card flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pt-5 pb-4">
          <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            Catch Compass · Saltwater Logbook
          </p>
          <h2 id="first-run-title" className="font-display text-3xl text-teal">
            Start with photos you already have
          </h2>
          <p className="text-sm text-ink">
            Pull old trip photos off this phone — or any files — and put each catch on its date. Your
            journal can be going before you log the next one.
          </p>
          <ol className="list-decimal space-y-1 pl-4 text-sm text-ink">
            <li>Pick a batch from the camera roll, files, or a folder — not the whole phone.</li>
            <li>We pick out likely fish photos and read the date from the picture when it is there.</li>
            <li>Confirm each one, pin the water, and save. One photo is one trip.</li>
          </ol>
          <button
            type="button"
            data-testid="setup-import-photos"
            onClick={goPhotos}
            className="w-full rounded-2xl bg-copper px-4 py-3 text-lg font-semibold text-white"
          >
            Find fish photos
          </button>
          <button
            type="button"
            data-testid="setup-one-photo"
            onClick={goOne}
            className="w-full rounded-2xl bg-teal px-4 py-3 font-semibold text-white"
          >
            Add one photo
          </button>
          <button
            type="button"
            data-testid="setup-skip"
            onClick={finish}
            className="w-full rounded-2xl border-2 border-line bg-card px-4 py-3 font-semibold text-ink"
          >
            Skip / Do later
          </button>
          <p className="text-center text-xs text-ink-muted">
            No photos required. Skipping leaves an empty journal and will not ask again. Open Help
            anytime to import later.
          </p>
        </div>
      </div>
    </div>
  );
}
