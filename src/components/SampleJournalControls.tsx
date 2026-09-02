"use client";

import { useEffect, useState } from "react";

export function SampleJournalControls({
  onChanged,
  compact = false,
}: {
  onChanged?: () => void;
  compact?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  function refresh() {
    fetch("/api/samples")
      .then((r) => r.json())
      .then((data) => {
        setLoaded(Boolean(data.loaded));
        setCount(Number(data.count) || 0);
      })
      .catch(() => {});
  }

  useEffect(() => {
    refresh();
  }, []);

  async function run(action: "load" | "remove") {
    setBusy(true);
    try {
      const res = await fetch("/api/samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      setLoaded(Boolean(data.loaded));
      setCount(Number(data.count) || 0);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  if (compact && loaded) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => void run("remove")}
        className="text-sm font-semibold text-ink-muted disabled:opacity-60"
      >
        {busy ? "Removing…" : `Remove ${count} sample ${count === 1 ? "catch" : "catches"}`}
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={busy || loaded}
        onClick={() => void run("load")}
        className="w-full rounded-2xl border border-line bg-card px-4 py-3 font-semibold disabled:opacity-60"
      >
        {busy && !loaded ? "Loading…" : loaded ? `${count} sample catches loaded` : "Load sample catches"}
      </button>
      {loaded ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run("remove")}
          className="w-full text-center text-sm font-semibold text-ink-muted disabled:opacity-60"
        >
          {busy ? "Removing…" : "Remove sample catches"}
        </button>
      ) : (
        <p className="text-center text-xs text-ink-muted">
          Optional examples only. Your journal stays empty until you log a catch or load these.
        </p>
      )}
    </div>
  );
}
