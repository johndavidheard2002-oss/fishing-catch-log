"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CatchForm } from "@/components/CatchForm";

export function LogClient() {
  const params = useSearchParams();
  const router = useRouter();
  const shouldBackfill = params.get("past") === "1" || Boolean(params.get("photo"));

  useEffect(() => {
    if (!shouldBackfill) return;
    const next = new URLSearchParams(params.toString());
    router.replace(`/backfill?${next.toString()}`);
  }, [shouldBackfill, params, router]);

  if (shouldBackfill) {
    return <p className="on-wash-chip text-sm">Opening Backfill…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="page-intro">
        <h1 className="font-display text-3xl text-teal">Log a catch</h1>
        <p className="text-sm text-ink-muted">
          Take a photo. Species fills in from the picture — tap the name only if it&apos;s wrong.
          A live photo uses the location you allowed at sign-in. Pick or name the area, save.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/bait/new" className="font-semibold text-teal">
            Logging bait instead?
          </Link>
        </p>
      </div>
      <CatchForm mode="create" />
    </div>
  );
}
