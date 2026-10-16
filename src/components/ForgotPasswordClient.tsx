"use client";

import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordClient({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setError(data.error || "Could not send the reset email. Try again.");
        return;
      }
      setSent(data.message || "Check your email for a reset link.");
    } catch {
      setError("Could not reach the journal. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="page-intro space-y-2 text-center">
        <h1 className="font-display text-3xl text-teal">Forgot password</h1>
        <p className="text-sm text-ink">
          Enter the email you use for Tide Mark. We will email you a link to choose a new password.
        </p>
      </section>
      <section className="journal-card space-y-3 rounded-2xl p-4" data-testid="forgot-password">
        {sent ? (
          <p className="text-sm text-ink" data-testid="forgot-sent" role="status">
            {sent}
          </p>
        ) : (
          <form onSubmit={(event) => void submit(event)} className="space-y-3">
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
            {error ? <p className="text-sm text-copper">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl bg-copper px-4 py-3 text-lg font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <p className="text-center text-sm">
          <Link href="/signin" data-testid="forgot-back" className="font-semibold text-teal underline">
            Back to sign in
          </Link>
        </p>
      </section>
    </div>
  );
}
