"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type Angler = { id: string; name: string; inviteCode: string };
type Buddy = Angler & { linkedAt: string };

const INCLUDE_KEY = "cast-log-include-shared";

function subscribeInclude(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("cast-log-include", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("cast-log-include", cb);
  };
}

function includeSnapshot() {
  return localStorage.getItem(INCLUDE_KEY) === "1";
}

export function useIncludeShared(): [boolean, (next: boolean) => void] {
  const on = useSyncExternalStore(subscribeInclude, includeSnapshot, () => false);
  function update(next: boolean) {
    localStorage.setItem(INCLUDE_KEY, next ? "1" : "0");
    window.dispatchEvent(new Event("cast-log-include"));
  }
  return [on, update];
}

export function sharedQuery(includeShared: boolean): string {
  return includeShared ? "includeShared=1" : "";
}

export function BuddyPanel() {
  const [me, setMe] = useState<Angler | null>(null);
  const [profiles, setProfiles] = useState<Angler[]>([]);
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [code, setCode] = useState("");
  const [buddyName, setBuddyName] = useState("");
  const [myName, setMyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function refresh() {
    const [meRes, buddyRes] = await Promise.all([fetch("/api/me"), fetch("/api/buddies")]);
    const meData = await meRes.json();
    const buddyData = await buddyRes.json();
    setMe(meData.me ?? null);
    setProfiles(meData.profiles ?? []);
    setMyName(meData.me?.name ?? "");
    setBuddies(buddyData.buddies ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch("/api/me"), fetch("/api/buddies")])
      .then(async ([meRes, buddyRes]) => {
        const meData = await meRes.json();
        const buddyData = await buddyRes.json();
        if (cancelled) return;
        setMe(meData.me ?? null);
        setProfiles(meData.profiles ?? []);
        setMyName(meData.me?.name ?? "");
        setBuddies(buddyData.buddies ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveName() {
    await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: myName }),
    });
    refresh();
  }

  async function linkCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/buddies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not link");
      return;
    }
    setCode("");
    refresh();
  }

  async function createBuddy(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/buddies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: buddyName }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not create buddy");
      return;
    }
    setBuddyName("");
    refresh();
  }

  async function unlink(id: string) {
    await fetch(`/api/buddies/${id}`, { method: "DELETE" });
    refresh();
  }

  async function switchTo(id: string) {
    await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ switchTo: id }),
    });
    window.location.reload();
  }

  return (
    <section className="journal-card space-y-3 rounded-2xl p-4">
      <h2 className="font-display text-2xl text-teal">Linked buddies</h2>
      <p className="text-sm text-ink-muted">
        Sharing is never public. Combined History, Plan, and Spots only include trips you
        explicitly share, and only with people you&apos;ve linked. Unapproved users see nothing.
      </p>
      <p className="text-xs text-ink-muted">Only shared with people you&apos;ve linked.</p>

      <label className="block text-sm">
        <span className="mb-1 block font-semibold">Your name</span>
        <div className="flex gap-2">
          <input
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2"
          />
          <button type="button" onClick={saveName} className="rounded-xl bg-teal px-3 py-2 text-sm font-semibold text-white">
            Save
          </button>
        </div>
      </label>

      <div>
        <p className="text-sm font-semibold">Your invite code</p>
        <div className="mt-1 flex items-center gap-2">
          <code className="rounded-xl bg-paper-deep px-3 py-2 text-sm">{me?.inviteCode ?? "…"}</code>
          <button
            type="button"
            className="text-sm font-semibold text-teal"
            onClick={async () => {
              if (!me?.inviteCode) return;
              await navigator.clipboard?.writeText(me.inviteCode);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <form onSubmit={linkCode} className="space-y-2">
        <p className="text-sm font-semibold">Link with a code</p>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CAST-XXXXXX"
            className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2"
          />
          <button type="submit" className="rounded-xl bg-copper px-3 py-2 text-sm font-semibold text-white">
            Link
          </button>
        </div>
      </form>

      <form onSubmit={createBuddy} className="space-y-2">
        <p className="text-sm font-semibold">Household / demo profile</p>
        <p className="text-xs text-ink-muted">
          Creates a second angler on this journal so you can try linking on one phone. Production
          auth (magic link / accounts) would replace profile switching.
        </p>
        <div className="flex gap-2">
          <input
            value={buddyName}
            onChange={(e) => setBuddyName(e.target.value)}
            placeholder="Buddy name"
            className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2"
          />
          <button type="submit" className="rounded-xl border border-line px-3 py-2 text-sm font-semibold">
            Add
          </button>
        </div>
      </form>

      {error ? <p className="text-sm text-copper">{error}</p> : null}

      <ul className="space-y-2">
        {buddies.length === 0 ? (
          <li className="text-sm text-ink-muted">No linked buddies yet.</li>
        ) : (
          buddies.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="font-semibold">{b.name}</span>
              <button type="button" className="text-copper" onClick={() => unlink(b.id)}>
                Unlink
              </button>
            </li>
          ))
        )}
      </ul>

      {profiles.length > 1 ? (
        <div>
          <p className="mb-1 text-sm font-semibold">Switch profile on this journal</p>
          <div className="flex flex-wrap gap-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => switchTo(p.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  p.id === me?.id ? "bg-teal text-white" : "border border-line bg-card"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function SharedToggle({
  includeShared,
  onChange,
}: {
  includeShared: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 rounded-2xl border border-line bg-card px-3 py-2 text-sm">
      <input
        type="checkbox"
        checked={includeShared}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1"
      />
      <span>
        <span className="font-semibold">Include shared from linked buddies</span>
        <span className="mt-0.5 block text-xs text-ink-muted">
          Only trips they marked share, and only people you&apos;ve linked. Never public.
        </span>
      </span>
    </label>
  );
}
