"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CatchForm } from "@/components/CatchForm";
import { SimilarList } from "@/components/SimilarList";
import { habitatLabel } from "@/lib/habitat";
import { speciesLabel } from "@/lib/species";
import { PRIVACY_LINE } from "@/lib/privacy";
import { CONDITION_LABELS } from "@/lib/labels";
import { SaveToPhotosButton } from "@/components/SaveToPhotosButton";
import { coordsLookDifferent } from "@/lib/location";
import { catchPhotoFilename, photoSrc, weatherLine } from "@/lib/photo";
import { formatCaughtAt } from "@/lib/time";
import type { CatchRecord, SimilarMatch } from "@/lib/types";

export function CatchDetail({ id }: { id: string }) {
  const router = useRouter();
  const [record, setRecord] = useState<CatchRecord | null>(null);
  const [matches, setMatches] = useState<SimilarMatch[]>([]);
  const [editing, setEditing] = useState(false);
  const [focusSpot, setFocusSpot] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/catches/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.catch) setRecord(data.catch);
        else setError("Catch not found");
      });
    fetch(`/api/catches/${id}/similar`)
      .then((r) => r.json())
      .then((data) => setMatches(data.matches ?? []));
  }, [id]);

  async function onDelete() {
    if (!confirm("Delete this catch from your journal?")) return;
    await fetch(`/api/catches/${id}`, { method: "DELETE" });
    router.push("/history");
  }

  if (error) return <p className="text-ink-muted">{error}</p>;
  if (!record) return <p className="text-ink-muted">Opening the page…</p>;

  const src = photoSrc(record.photoPath);

  if (editing) {
    return (
      <div className="space-y-4">
        <button type="button" className="text-sm text-teal" onClick={() => setEditing(false)}>
          ← Cancel
        </button>
        <CatchForm mode="edit" initial={record} focusLocation={focusSpot} />
      </div>
    );
  }

  return (
    <article className="space-y-5">
      <div className="journal-card overflow-hidden rounded-3xl">
        <div className="relative aspect-[4/3] bg-paper-deep">
          {src ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={record.species} className="h-full w-full object-cover" />
              <SaveToPhotosButton
                src={src}
                filename={catchPhotoFilename({
                  species: record.speciesList?.length ? record.speciesList : record.species,
                  caughtAt: record.caughtAt,
                  photoPath: record.photoPath,
                })}
                variant="overlay"
              />
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-ink-muted">No photo</div>
          )}
        </div>
        <div className="space-y-2 p-4">
          <h1 className="font-display text-3xl text-teal">
            {speciesLabel(record.speciesList?.length ? record.speciesList : record.species)}
          </h1>
          <p className="text-ink-muted">{record.placeName || "Unnamed spot"}</p>
          <p className="text-sm">{formatCaughtAt(record.caughtAt)}</p>
          <p className="text-sm capitalize">
            {habitatLabel(record.habitat)} · {record.season} · {record.timeOfDay} ·{" "}
            {weatherLine(record)}
          </p>
          {record.sharedWithLinked ? (
            <p className="text-xs text-ink-muted">
              {PRIVACY_LINE} Never public. No feed.
            </p>
          ) : (
            <p className="text-xs text-ink-muted">Private to you. Not shared with anyone.</p>
          )}
          <p className="text-xs text-ink-muted">Logged by {record.ownerName}</p>
          {record.speciesSuggested ? (
            <p className="text-xs text-ink-muted">
              Assist suggested {record.speciesSuggested}
              {record.speciesConfidence != null
                ? ` (${Math.round(record.speciesConfidence * 100)}%)`
                : ""}{" "}
              · {record.speciesSource === "edited" ? "you edited it" : "confirm if you haven't"}
            </p>
          ) : null}
        </div>
      </div>

      <dl className="journal-card grid grid-cols-2 gap-3 rounded-2xl p-4 text-sm">
        <Item label="Temp" value={record.temperatureF != null ? `${record.temperatureF}°F` : "—"} />
        <Item
          label="Sky"
          value={record.weatherCondition ? CONDITION_LABELS[record.weatherCondition] : "—"}
        />
        <Item
          label="Wind"
          value={
            record.windSpeedMph != null && record.windDirection
              ? `${record.windDirection} ${record.windSpeedMph} mph`
              : record.windSpeedMph != null
                ? `${record.windSpeedMph} mph`
                : record.windDirection || "—"
          }
        />
        <Item
          label="Moon"
          value={
            record.moonPhase
              ? `${record.moonPhase}${
                  record.moonIllumination != null ? ` · ${Math.round(record.moonIllumination)}%` : ""
                }`
              : "—"
          }
        />
        <Item
          label="Pressure"
          value={
            record.pressureInHg != null || record.pressureMb != null
              ? [
                  record.pressureInHg != null ? `${record.pressureInHg.toFixed(2)} inHg` : null,
                  record.pressureMb != null ? `${record.pressureMb} mb` : null,
                  record.pressureTrend,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "—"
          }
        />
        <Item
          label="Precip"
          value={record.precipitationIn != null ? `${record.precipitationIn} in` : "—"}
        />
        <Item label="Habitat" value={habitatLabel(record.habitat)} />
        <Item label="Bait" value={record.bait || "—"} />
        <Item label="Tide" value={record.tide || "—"} />
        <Item label="Water" value={record.waterClarity || "—"} />
        <Item
          label="Catch location"
          value={
            record.latitude != null && record.longitude != null
              ? `${record.placeName ? `${record.placeName} · ` : ""}${record.latitude.toFixed(4)}, ${record.longitude.toFixed(4)}`
              : record.placeName || "—"
          }
        />
        {record.photoTakenLatitude != null &&
        record.photoTakenLongitude != null &&
        coordsLookDifferent(
          record.latitude,
          record.longitude,
          record.photoTakenLatitude,
          record.photoTakenLongitude,
        ) ? (
          <Item
            label="Photo taken at"
            value={`${record.photoTakenLatitude.toFixed(4)}, ${record.photoTakenLongitude.toFixed(4)}`}
          />
        ) : null}
      </dl>

      {record.notes ? (
        <p className="journal-card rounded-2xl p-4 text-sm">{record.notes}</p>
      ) : null}

      {src ? (
        <div>
          <SaveToPhotosButton
            src={src}
            filename={catchPhotoFilename({
              species: record.speciesList?.length ? record.speciesList : record.species,
              caughtAt: record.caughtAt,
              photoPath: record.photoPath,
            })}
          />
          <p className="mt-1.5 text-xs text-ink-muted">
            Save this catch photo to this phone whenever you want. Catch Compass never adds it to
            Photos by itself.
          </p>
        </div>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex-1 rounded-xl bg-teal py-3 font-semibold text-white"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => {
            setFocusSpot(true);
            setEditing(true);
          }}
          className="rounded-xl border border-line px-4 py-3 font-semibold"
        >
          Edit spot
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-xl border border-line px-4 py-3 font-semibold"
        >
          Delete
        </button>
      </div>

      <section id="similar" className="space-y-3">
        <h2 className="font-display text-2xl text-teal">Similar to this catch</h2>
        <p className="text-sm text-ink-muted">
          Past logs that match weather, season, time of day, species, or spot.
        </p>
        <SimilarList matches={matches} />
        <Link
          href={`/history?species=${encodeURIComponent(record.species)}`}
          className="inline-block text-sm font-semibold text-teal"
        >
          Browse all {speciesLabel(record.speciesList?.length ? record.speciesList : record.species)}
        </Link>
      </section>
    </article>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
