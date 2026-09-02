"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BaitSpotForm } from "./BaitSpotForm";
import { baitTypesLabel } from "@/lib/bait";
import { habitatLabel } from "@/lib/habitat";
import { CONDITION_LABELS } from "@/lib/labels";
import { PRIVACY_LINE } from "@/lib/privacy";
import { photoSrc } from "@/lib/photo";
import { formatCaughtAt } from "@/lib/time";
import type { BaitSpot } from "@/lib/types";

export function BaitSpotDetail({ id }: { id: string }) {
  const router = useRouter();
  const [record, setRecord] = useState<BaitSpot | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/bait-spots/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("missing");
        return r.json();
      })
      .then((data) => {
        if (data.spot) setRecord(data.spot);
        else setError("Bait spot not found");
      })
      .catch(() => setError("Could not open this bait spot."));
  }, [id]);

  async function onDelete() {
    if (!confirm("Delete this bait spot?")) return;
    await fetch(`/api/bait-spots/${id}`, { method: "DELETE" });
    router.push("/spots?kind=bait");
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="on-wash-chip text-sm text-copper">{error}</p>
        <Link href="/spots?kind=bait" className="on-wash-chip w-fit text-sm font-semibold text-teal">
          Back to bait
        </Link>
      </div>
    );
  }

  if (!record) {
    return <p className="on-wash-chip text-sm">Opening bait spot…</p>;
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <button type="button" className="on-wash-chip w-fit text-sm font-semibold text-teal" onClick={() => setEditing(false)}>
          Cancel
        </button>
        <BaitSpotForm mode="edit" initial={record} />
      </div>
    );
  }

  const src = photoSrc(record.photoPath);
  return (
    <div className="space-y-4">
      <Link href="/spots?kind=bait" className="on-wash-chip w-fit text-sm font-semibold text-teal">
        ← Bait
      </Link>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="w-full rounded-3xl object-cover" />
      ) : null}
      <div className="page-intro">
        <p className="text-xs font-semibold uppercase tracking-wide text-copper">Bait</p>
        <h1 className="font-display text-3xl text-teal">{record.placeName || "Unnamed hole"}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {baitTypesLabel(record.baitTypes)} · {formatCaughtAt(record.loggedAt)} ·{" "}
          {habitatLabel(record.habitat)}
        </p>
      </div>
      <p className="journal-card rounded-2xl px-3 py-3 text-sm">
        {record.weatherCondition ? CONDITION_LABELS[record.weatherCondition] : "Conditions logged"}
        {record.temperatureF != null ? ` · ${Math.round(record.temperatureF)}°F` : ""}
        {record.tide ? ` · ${record.tide} tide` : ""}
        {record.windSpeedMph != null
          ? ` · ${record.windDirection ? `${record.windDirection} ` : ""}${Math.round(record.windSpeedMph)} mph`
          : ""}
      </p>
      {record.notes ? <p className="rounded-2xl border border-line bg-card px-3 py-3 text-sm">{record.notes}</p> : null}
      <p className="on-wash-chip text-xs">{PRIVACY_LINE}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-full bg-teal px-4 py-2 text-sm font-semibold text-white"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
