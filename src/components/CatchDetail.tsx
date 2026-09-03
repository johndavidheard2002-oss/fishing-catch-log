"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CatchForm } from "@/components/CatchForm";
import { SimilarList } from "@/components/SimilarList";
import { SaveToPhotosButton } from "@/components/SaveToPhotosButton";
import { habitatLabel } from "@/lib/habitat";
import { catchFishLabel, catchSpeciesTitle } from "@/lib/count";
import { speciesLabel } from "@/lib/species";
import { PRIVACY_LINE } from "@/lib/privacy";
import { CONDITION_LABELS } from "@/lib/labels";
import { coordsLookDifferent } from "@/lib/location";
import { catchPhotoFilename, photoSrc, weatherLine } from "@/lib/photo";
import { tidesApplyToHabitat, tideWeatherBits } from "@/lib/tides/snapshot";
import { formatCaughtAt } from "@/lib/time";
import { groupSpots } from "@/lib/filters";
import { hasSavedPin } from "@/lib/location-map";
import type { CatchRecord, SimilarMatch } from "@/lib/types";

const SpotMap = dynamic(() => import("@/components/SpotMap").then((m) => m.SpotMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-2xl border border-line bg-paper-deep text-sm text-ink-muted">
      Loading map…
    </div>
  ),
});

export function CatchDetail({ id }: { id: string }) {
  const router = useRouter();
  const [record, setRecord] = useState<CatchRecord | null>(null);
  const [matches, setMatches] = useState<SimilarMatch[]>([]);
  const [editing, setEditing] = useState(false);
  const [focusSpot, setFocusSpot] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/catches/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("missing");
        return r.json();
      })
      .then((data) => {
        if (data.catch) setRecord(data.catch);
        else setError("Catch not found");
      })
      .catch(() => setError("Could not open this catch. Go back and try again."));
    fetch(`/api/catches/${id}/similar`)
      .then(async (r) => (r.ok ? r.json() : { matches: [] }))
      .then((data) => setMatches(data.matches ?? []))
      .catch(() => {});
  }, [id]);

  async function onDelete() {
    if (!confirm("Delete this catch?")) return;
    await fetch(`/api/catches/${id}`, { method: "DELETE" });
    router.push("/calendar");
  }

  if (error) return <p className="on-wash-chip text-ink">{error}</p>;
  if (!record) return <p className="on-wash-chip">Opening the page…</p>;

  const src = photoSrc(record.photoPath);

  if (editing) {
    return (
      <div className="space-y-4">
        <button type="button" className="on-wash-chip w-fit text-sm text-teal" onClick={() => setEditing(false)}>
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
            {catchSpeciesTitle(record)}
          </h1>
          <p className="text-ink-muted">
            {catchFishLabel(record)} · {record.placeName || "Unnamed spot"}
          </p>
          <p className="text-sm">{formatCaughtAt(record.caughtAt)}</p>
          <p className="text-sm">
            {habitatLabel(record.habitat)} · {weatherLine(record)}
          </p>
          {record.sharedWithLinked ? (
            <p className="text-xs text-ink-muted">
              {PRIVACY_LINE} Never public. No feed.
            </p>
          ) : (
            <p className="text-xs text-ink-muted">Private to you. Not shared with anyone.</p>
          )}
          <p className="text-xs text-ink-muted">Logged by {record.ownerName}</p>
        </div>
      </div>

      <CatchLocationMap record={record} />

      <dl className="journal-card grid grid-cols-2 gap-3 rounded-2xl p-4 text-sm">
        <Item label="Fish" value={catchFishLabel(record)} />
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
          label="Tide"
          value={
            tidesApplyToHabitat(record.habitat)
              ? tideWeatherBits({
                  habitat: record.habitat,
                  tide: record.tide,
                  tideHeightFt: record.tideHeightFt,
                  tideDetail: record.tideDetail,
                }).join(" · ") || "—"
              : "Does not apply"
          }
        />
        <Item
          label="Precip"
          value={record.precipitationIn != null ? `${record.precipitationIn} in` : "—"}
        />
        <Item label="Habitat" value={habitatLabel(record.habitat)} />
        <Item label="Bait" value={record.bait || "—"} />
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
          <p className="on-wash-chip mt-1.5 text-xs">
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
        <h2 className="on-wash-chip w-fit font-display text-2xl text-teal">Similar to this catch</h2>
        <p className="on-wash-chip text-sm">
          Past logs that match tide, clock time, weather, species, or spot.
        </p>
        <SimilarList matches={matches} />
        <Link
          href={`/calendar?view=list&species=${encodeURIComponent(record.species)}`}
          className="on-wash-chip inline-block text-sm font-semibold text-teal"
        >
          Browse all {speciesLabel(record.speciesList?.length ? record.speciesList : record.species)}
        </Link>
      </section>
    </article>
  );
}

function CatchLocationMap({ record }: { record: CatchRecord }) {
  const hasPin = hasSavedPin(record.latitude, record.longitude);
  const spots = hasPin ? groupSpots([record]) : [];
  return (
    <section className="space-y-1" data-testid="catch-location-map">
      <p className="on-wash-chip w-fit text-xs font-semibold uppercase tracking-wide">Location</p>
      {hasPin ? (
        <SpotMap
          spots={spots}
          selectedKey={spots[0]?.key ?? null}
          className="h-64 w-full overflow-hidden rounded-2xl border border-line bg-paper-deep"
        />
      ) : (
        <p
          className="journal-card rounded-2xl px-3 py-6 text-sm text-ink-muted"
          data-testid="catch-location-map-empty"
        >
          This catch has no saved pin. Tap Edit spot to drop one on the map.
        </p>
      )}
    </section>
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
