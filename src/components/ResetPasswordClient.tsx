"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { notifyAuthChange } from "@/lib/tour";

export function ResetPasswordClient({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkState, setLinkState] = useState<"checking" | "valid" | "invalid">(token ? "checking" : "invalid");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`/api/auth/reset?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { valid?: boolean }) => {
        if (!cancelled) setLinkState(data.valid ? "valid" : "invalid");
      })
      .catch(() => {
        // Let them try; the POST is the real check.
        if (!cancelled) setLinkState("valid");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirm }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not reset the password.");
        return;
      }
      setDone(true);
      notifyAuthChange();
    } catch {
      setError("Could not reach the journal. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="page-intro space-y-2 text-center">
        <h1 className="font-display text-3xl text-teal">{done ? "Password updated" : "Choose a new password"}</h1>
      </section>
      <section className="journal-card space-y-3 rounded-2xl p-4" data-testid="reset-password">
        {done ? (
          <>
            <p className="text-sm text-ink" data-testid="reset-done" role="status">
              Your password is updated and you are signed in here. Other devices were signed out. In the
              Tide Mark app, sign in with your new password.
            </p>
            <Link
              href="/"
              data-testid="reset-open-journal"
              className="flex w-full items-center justify-center rounded-2xl bg-copper px-4 py-3 text-lg font-semibold text-white"
            >
              Open my journal
            </Link>
          </>
        ) : linkState === "invalid" ? (
          <>
            <p className="text-sm text-copper" data-testid="reset-invalid">
              This reset link is invalid or has expired. Request a new one.
            </p>
            <Link
              href="/forgot-password"
              className="flex w-full items-center justify-center rounded-2xl bg-copper px-4 py-3 text-lg font-semibold text-white"
            >
              Send a new link
            </Link>
          </>
        ) : (
          <form onSubmit={(event) => void submit(event)} className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">New password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                className="w-full rounded-xl border border-line bg-paper px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">Confirm new password</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                className="w-full rounded-xl border border-line bg-paper px-3 py-2"
              />
            </label>
            <p className="text-xs text-ink-muted">At least 8 characters.</p>
            {error ? <p className="text-sm text-copper">{error}</p> : null}
            <button
              type="submit"
              disabled={busy || linkState === "checking"}
              className="w-full rounded-2xl bg-copper px-4 py-3 text-lg font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}
        {!done ? (
          <p className="text-center text-sm">
            <Link href="/signin" className="font-semibold text-teal underline">
              Back to sign in
            </Link>
          </p>
        ) : null}
      </section>
    </div>
  );
}
