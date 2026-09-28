"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DELETE_ACCOUNT_PHRASE } from "@/lib/delete-account-phrase";
import { clearSavedLiveLocation } from "@/lib/location";
import { clearOfflineAccountCache } from "@/lib/offline-store";
import { setScanQueue } from "@/lib/scan-queue";
import { notifyAuthChange } from "@/lib/tour";

export function DeleteAccount({ idPrefix = "delete-account" }: { idPrefix?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const phraseReady = confirm.trim().toUpperCase() === DELETE_ACCOUNT_PHRASE;

  function close() {
    if (busy) return;
    setOpen(false);
    setPassword("");
    setConfirm("");
    setError("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!phraseReady || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirm: confirm.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not delete this account.");
        return;
      }
      clearSavedLiveLocation();
      setScanQueue([]);
      await clearOfflineAccountCache().catch(() => {});
      notifyAuthChange();
      router.replace("/signin");
      router.refresh();
    } catch {
      setError("Could not reach the journal. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        data-testid={idPrefix}
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm font-semibold text-ink"
      >
        Delete account
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="space-y-2 rounded-xl border border-line bg-card p-3"
      data-testid={`${idPrefix}-confirm`}
    >
      <p className="text-sm font-semibold">Delete this account?</p>
      <p className="text-sm text-ink">
        This permanently deletes your Tide Mark account and journal: catches, photos, bait spots, notes, named
        areas, and friend links. This cannot be undone. Log out only ends this session.
      </p>
      <label className="block text-sm">
        <span className="mb-1 block font-semibold">Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          data-testid={`${idPrefix}-password`}
          className="w-full rounded-xl border border-line bg-paper px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-semibold">Type {DELETE_ACCOUNT_PHRASE} to confirm</span>
        <input
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoCapitalize="characters"
          autoCorrect="off"
          required
          data-testid={`${idPrefix}-phrase`}
          className="w-full rounded-xl border border-line bg-paper px-3 py-2"
        />
      </label>
      {error ? (
        <p className="text-sm text-copper" data-testid={`${idPrefix}-error`}>
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy || !phraseReady || password.length < 1}
        data-testid={`${idPrefix}-submit`}
        className="w-full rounded-xl bg-copper px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Deleting…" : "Delete my account"}
      </button>
      <button
        type="button"
        onClick={close}
        disabled={busy}
        data-testid={`${idPrefix}-cancel`}
        className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold text-ink disabled:opacity-60"
      >
        Cancel
      </button>
    </form>
  );
}
