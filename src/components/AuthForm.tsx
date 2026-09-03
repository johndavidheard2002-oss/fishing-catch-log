"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AUTH_PRIVACY_LINE } from "@/lib/privacy";
import { notifyAuthChange } from "@/lib/tour";

export function AuthForm({
  defaultName = "",
  claimExisting = false,
  nextPath = "/",
  onSignedIn,
}: {
  defaultName?: string;
  claimExisting?: boolean;
  nextPath?: string;
  onSignedIn?: (name: string) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(mode === "create" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:
          mode === "create"
            ? JSON.stringify({ name, email, password, confirm })
            : JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not sign in.");
        return;
      }
      onSignedIn?.(typeof (data as { me?: { name?: string } }).me?.name === "string" ? (data as { me: { name: string } }).me.name : name);
      notifyAuthChange();
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Could not reach the journal. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="journal-card space-y-3 rounded-2xl p-4" data-testid="auth-form">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`rounded-xl py-2 text-sm font-semibold ${
            mode === "create" ? "bg-teal text-white" : "border border-line bg-card text-ink"
          }`}
        >
          Create journal
        </button>
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`rounded-xl py-2 text-sm font-semibold ${
            mode === "signin" ? "bg-teal text-white" : "border border-line bg-card text-ink"
          }`}
        >
          Sign in
        </button>
      </div>
      <h2 className="font-display text-2xl text-teal">
        {mode === "create"
          ? claimExisting
            ? "Save this journal"
            : "Create your journal"
          : "Sign in"}
      </h2>
      {mode === "create" && claimExisting ? (
        <p className="text-sm text-ink">
          Trips already on this phone stay yours. Add email and a password so only you can open them.
        </p>
      ) : null}
      <p className="text-sm text-ink-muted">{AUTH_PRIVACY_LINE}</p>
      <form onSubmit={(event) => void submit(event)} className="space-y-3">
        {mode === "create" ? (
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Your name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="w-full rounded-xl border border-line bg-paper px-3 py-2"
            />
          </label>
        ) : null}
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className="w-full rounded-xl border border-line bg-paper px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "create" ? "new-password" : "current-password"}
            minLength={8}
            required
            className="w-full rounded-xl border border-line bg-paper px-3 py-2"
          />
        </label>
        {mode === "create" ? (
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Confirm password</span>
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
        ) : null}
        {error ? <p className="text-sm text-copper">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-copper px-4 py-3 text-lg font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Working…" : mode === "create" ? "Create journal" : "Sign in"}
        </button>
      </form>
    </section>
  );
}
