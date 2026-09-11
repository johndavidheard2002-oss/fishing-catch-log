"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BaitSpotForm } from "./BaitSpotForm";
import { OwnerShareBadge } from "@/components/OwnerShareBadge";
import { ShareFriendPicker, selectedShareBuddyIds, type ShareFriend } from "@/components/ShareFriendPicker";
import { hasSavedPin } from "@/lib/location-map";

const SpotMap = dynamic(() => import("@/components/SpotMap").then((m) => m.SpotMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-2xl border border-line bg-paper-deep text-sm text-ink-muted">
      Loading map…
    </div>
  ),
});
import { AddToPlanButton } from "@/components/AddToPlanButton";
import { CHANGES_SAVED_LABEL } from "@/lib/feedback";
import { baitTypesLabel } from "@/lib/bait";
import { habitatLabel } from "@/lib/habitat";
import { canShowAddToPlan, dropCommittedPlanSpot, pendingPlanSpotFromBait } from "@/lib/pending-plan-spot";
import {
  plannedPhotoUnplanRequest,
  planSpotsToUnplan,
  UNPLAN_SPOT_CONFIRM,
} from "@/lib/notes";
import { CONDITION_LABELS } from "@/lib/labels";
import { ownerShareStatusLine } from "@/lib/sharing";
import { personalPhotoSrc } from "@/lib/photo";
import { formatCaughtAt } from "@/lib/time";
import type { BaitSpot } from "@/lib/types";

export function BaitSpotDetail({
  id,
  fromPlan = false,
  planNote = null,
  planDay = null,
}: {
  id: string;
  fromPlan?: boolean;
  planNote?: string | null;
  planDay?: string | null;
}) {
  const router = useRouter();
  const unplan = plannedPhotoUnplanRequest({ fromPlan, planNote, planDay });
  const [record, setRecord] = useState<BaitSpot | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerId, setViewerId] = useState<string | undefined>();
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [buddies, setBuddies] = useState<ShareFriend[]>([]);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => setViewerId(data.me?.id))
      .catch(() => {});
    fetch("/api/buddies")
      .then((r) => r.json())
      .then((data) =>
        setBuddies(
          ((data.buddies ?? []) as { id?: string; name?: string }[])
            .filter((buddy): buddy is ShareFriend => Boolean(buddy.id && buddy.name)),
        ),
      )
      .catch(() => {});
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
    if (unplan.mode === "unplan") {
      if (!confirm(UNPLAN_SPOT_CONFIRM)) return;
      try {
        const noteIds = new Set<string>();
        if (unplan.calendarNoteId) noteIds.add(unplan.calendarNoteId);
        if (unplan.lookupPlanNotes) {
          const res = await fetch("/api/calendar-notes?for=plan", { cache: "no-store" });
          const data = await res.json().catch(() => ({}));
          for (const noteId of planSpotsToUnplan(data.notes ?? [], {
            sourceBaitId: id,
            day: unplan.day,
          })) {
            noteIds.add(noteId);
          }
        }
        for (const noteId of noteIds) {
          const res = await fetch(`/api/calendar-notes/${noteId}`, { method: "DELETE" });
          if (!res.ok) throw new Error("unplan failed");
        }
        dropCommittedPlanSpot(
          typeof sessionStorage === "undefined" ? null : sessionStorage,
          { day: unplan.day ?? "", sourceBaitId: id },
        );
        router.push(unplan.returnTo);
      } catch {
        setError("Could not remove this spot from the plan.");
      }
      return;
    }
    if (!confirm("Delete this bait spot?")) return;
    await fetch(`/api/bait-spots/${id}`, { method: "DELETE" });
    router.push("/spots?kind=bait");
  }

  async function onShare(shared: boolean, buddyIds?: string[]) {
    if (!record) return;
    setShareBusy(true);
    setShareError(null);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baitSpotIds: [record.id],
          shared,
          ...(buddyIds ? { buddyIds } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { baitUpdated?: number };
      if (!res.ok || data.baitUpdated === 0) {
        setShareError("Could not update sharing.");
        return;
      }
      setRecord({
        ...record,
        sharedWithLinked: shared && !buddyIds,
        sharedWithBuddyIds: shared ? (buddyIds ?? []) : [],
      });
    } catch {
      setShareError("Could not update sharing.");
    } finally {
      setShareBusy(false);
    }
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

  const isOwner = Boolean(viewerId && record.anglerId === viewerId);

  if (editing && isOwner) {
    return (
      <div className="space-y-4">
        <button type="button" className="on-wash-chip w-fit text-sm font-semibold text-teal" onClick={() => setEditing(false)}>
          Cancel
        </button>
        <BaitSpotForm
          mode="edit"
          initial={record}
          onSaved={(next) => {
            setRecord(next);
            setEditing(false);
            setSavedNotice(true);
          }}
        />
      </div>
    );
  }

  const src = personalPhotoSrc(record.photoPath);
  const pendingPlan = canShowAddToPlan(record, viewerId, true)
    ? pendingPlanSpotFromBait(record)
    : null;
  return (
    <div className="space-y-4">
      <Link href="/spots?kind=bait" className="on-wash-chip w-fit text-sm font-semibold text-teal">
        ← Bait
      </Link>
      {savedNotice ? (
        <p
          data-testid="changes-saved"
          className="rounded-2xl border border-teal bg-teal/10 px-3 py-2 text-sm font-semibold text-teal"
        >
          {CHANGES_SAVED_LABEL}
        </p>
      ) : null}
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="w-full rounded-3xl object-cover" data-testid="bait-photo" />
      ) : null}
      <div className="page-intro">
        <p className="text-xs font-semibold uppercase tracking-wide text-copper">Bait</p>
        <div className="flex items-start gap-2">
          <h1 className="min-w-0 flex-1 font-display text-3xl text-teal">{record.placeName || "Unnamed hole"}</h1>
          {isOwner ? (
            <OwnerShareBadge
              sharedWithLinked={record.sharedWithLinked}
              sharedWithBuddyIds={record.sharedWithBuddyIds}
              friends={buddies}
            />
          ) : null}
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {baitTypesLabel(record.baitTypes)} · {formatCaughtAt(record.loggedAt)} ·{" "}
          {habitatLabel(record.habitat)}
        </p>
        {pendingPlan ? (
          <p className="mt-2 flex flex-wrap gap-1">
            <AddToPlanButton spot={pendingPlan} />
          </p>
        ) : null}
      </div>
      <p className="journal-card rounded-2xl px-3 py-3 text-sm">
        {record.weatherCondition ? CONDITION_LABELS[record.weatherCondition] : "Conditions logged"}
        {record.temperatureF != null ? ` · ${Math.round(record.temperatureF)}°F` : ""}
        {record.tide ? ` · ${record.tide} tide` : ""}
        {record.windSpeedMph != null
          ? ` · ${record.windDirection ? `${record.windDirection} ` : ""}${Math.round(record.windSpeedMph)} mph`
          : ""}
      </p>
      <section className="space-y-1" data-testid="bait-location-map">
        <p className="on-wash-chip w-fit text-xs font-semibold uppercase tracking-wide">Location</p>
        {hasSavedPin(record.latitude, record.longitude) ? (
          <SpotMap
            spots={[]}
            baitSpots={[record]}
            selectedKey={null}
            className="h-64 w-full overflow-hidden rounded-2xl border border-line bg-paper-deep"
          />
        ) : (
          <p className="journal-card rounded-2xl px-3 py-6 text-sm text-ink-muted">
            {isOwner
              ? "This bait hole has no saved pin. Tap Edit to drop one on the map."
              : "This bait hole has no saved pin."}
          </p>
        )}
      </section>
      {record.notes ? <p className="rounded-2xl border border-line bg-card px-3 py-3 text-sm">{record.notes}</p> : null}
      <p className="on-wash-chip text-xs" data-testid="owner-share-status">
        {ownerShareStatusLine({
          sharedWithLinked: record.sharedWithLinked,
          sharedWithBuddyIds: record.sharedWithBuddyIds,
          friends: buddies,
        })}
      </p>
      {isOwner ? (
        <div className="space-y-3" data-testid="bait-owner-actions">
          <div className="owner-action-row" data-testid="bait-action-row">
            <button
              type="button"
              onClick={() => setEditing(true)}
              data-testid="bait-edit"
              className="rounded-full bg-teal px-4 py-2 text-sm font-semibold text-white"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={shareBusy}
              aria-pressed={record.sharedWithLinked || (record.sharedWithBuddyIds?.length ?? 0) > 0}
              data-testid="bait-share"
              onClick={() =>
                void onShare(!(record.sharedWithLinked || (record.sharedWithBuddyIds?.length ?? 0) > 0))
              }
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                record.sharedWithLinked || (record.sharedWithBuddyIds?.length ?? 0) > 0
                  ? "border-2 border-teal bg-teal/15 text-teal"
                  : "bg-teal text-white"
              } disabled:opacity-50`}
            >
              {record.sharedWithLinked ? "Shared" : "Share"}
            </button>
            {unplan.mode === "unplan" ? (
              <button
                type="button"
                onClick={onDelete}
                data-testid="bait-unplan"
                className="rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold"
              >
                Remove from plan
              </button>
            ) : (
              <button
                type="button"
                onClick={onDelete}
                data-testid="bait-delete"
                className="rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold"
              >
                Delete
              </button>
            )}
          </div>
          <div data-testid="bait-share-block">
            <p className="text-xs text-ink-muted">
              Pick who sees this spot. Off until you choose.
            </p>
            <ShareFriendPicker
              buddies={buddies}
              disabled={shareBusy}
              selectedIds={selectedShareBuddyIds({
                sharedWithLinked: record.sharedWithLinked,
                sharedWithBuddyIds: record.sharedWithBuddyIds,
                buddyIds: buddies.map((buddy) => buddy.id),
              })}
              onChange={(ids) => {
                if (!ids.length) void onShare(false);
                else if (ids.length === buddies.length) void onShare(true);
                else void onShare(true, ids);
              }}
            />
          </div>
          {shareError ? <p className="mt-1 text-xs text-copper">{shareError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
