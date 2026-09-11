"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CatchForm } from "@/components/CatchForm";
import {
  isLogPhotoSessionDraft,
  markStaleHoldMigrationDone,
  shouldClearStaleHeldLogPhoto,
  shouldRemountLogFormAfterPageShow,
  shouldRunStaleHoldMigration,
} from "@/lib/log-photo-draft";
import { clearHeldOfflinePhoto } from "@/lib/offline-sync";

export function LogClient() {
  const params = useSearchParams();
  const router = useRouter();
  const [formEpoch, setFormEpoch] = useState(0);
  const [holdReady, setHoldReady] = useState(false);
  const shouldBackfill = params.get("past") === "1" || Boolean(params.get("photo"));

  useEffect(() => {
    if (!shouldBackfill) return;
    const next = new URLSearchParams(params.toString());
    router.replace(`/backfill?${next.toString()}`);
  }, [shouldBackfill, params, router]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const sessionDraft = isLogPhotoSessionDraft();
      if (shouldRunStaleHoldMigration() || shouldClearStaleHeldLogPhoto({ hasSessionDraft: sessionDraft })) {
        await clearHeldOfflinePhoto();
        markStaleHoldMigrationDone();
      }
      if (!cancelled) setHoldReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (
        !shouldRemountLogFormAfterPageShow({
          persisted: event.persisted,
          hasSessionDraft: isLogPhotoSessionDraft(),
        })
      ) {
        return;
      }
      void (async () => {
        await clearHeldOfflinePhoto();
        setFormEpoch((n) => n + 1);
      })();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  if (shouldBackfill) {
    return <p className="on-wash-chip text-sm">Opening Backfill…</p>;
  }

  if (!holdReady) {
    return <p className="on-wash-chip text-sm">Opening the log…</p>;
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-4">
      <div className="page-intro">
        <h1 className="font-display text-3xl text-teal">Log a catch</h1>
        <p className="text-sm text-ink-muted">
          Take a photo. Pick a species — tap a name or type one — or save and add it later. A live
          photo uses the location you allowed at sign-in. Pick or name the area, save.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/bait/new" className="font-semibold text-teal">
            Logging bait instead?
          </Link>
        </p>
      </div>
      <CatchForm key={formEpoch} mode="create" />
    </div>
  );
}
