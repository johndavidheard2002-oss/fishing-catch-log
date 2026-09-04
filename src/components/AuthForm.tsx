"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { LiveLocationPrompt } from "@/components/LiveLocationPrompt";
import {
  ALLOW_GPS_OPTIONS,
  detectPrivateBrowsing,
  persistAllowLocationOutcome,
  queryGeolocationPermission,
  readSavedLiveLocationStatus,
  requestDeviceGpsAttempt,
  waitForAllowLocationFix,
  writeSavedLiveLocationAllowed,
  type DeviceGpsAttempt,
  type GeolocationPermissionState,
  type LiveLocationStatus,
} from "@/lib/location";
import { AUTH_PRIVACY_LINE, PRIVACY_PATH } from "@/lib/privacy";
import { notifyAuthChange } from "@/lib/tour";

export function AuthForm({
  defaultName = "",
  nextPath = "/",
  defaultMode = "signin",
  onSignedIn,
  onPhaseChange,
}: {
  defaultName?: string;
  nextPath?: string;
  defaultMode?: "create" | "signin";
  onSignedIn?: (name: string) => void;
  onPhaseChange?: (phase: "form" | "location") => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "signin">(defaultMode);
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"form" | "location">("form");
  const [locationStatus, setLocationStatus] = useState<LiveLocationStatus>("prompt");
  const [privateBrowsing, setPrivateBrowsing] = useState(false);
  const [geoPermission, setGeoPermission] = useState<GeolocationPermissionState>("unknown");
  const allowAbortRef = useRef<AbortController | null>(null);

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
      const saved = readSavedLiveLocationStatus();
      if (saved === "ready" || saved === "denied") {
        enterJournal();
        return;
      }
      setPhase("location");
      onPhaseChange?.("location");
      setPrivateBrowsing(detectPrivateBrowsing());
      void queryGeolocationPermission().then(setGeoPermission);
      if (saved === "allowed") {
        resumeAllowedLocationWait();
      }
    } catch {
      setError("Could not reach the journal. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function enterJournal() {
    router.replace(nextPath);
    router.refresh();
  }

  function finishAllowWait(result: DeviceGpsAttempt) {
    const outcome = persistAllowLocationOutcome(result);
      setLocationStatus(
      outcome.savedStatus === "ready"
        ? "ready"
        : outcome.savedStatus === "denied"
          ? "denied"
          : outcome.savedStatus === "unavailable"
            ? "unavailable"
            : "prompt",
    );
    enterJournal();
  }

  function startAllowWait(firstAttempt?: Promise<DeviceGpsAttempt>) {
    allowAbortRef.current?.abort();
    const ac = new AbortController();
    allowAbortRef.current = ac;
    setLocationStatus("asking");
    writeSavedLiveLocationAllowed();
    void waitForAllowLocationFix({
      firstAttempt,
      signal: ac.signal,
    }).then((result) => {
      if (ac.signal.aborted) return;
      finishAllowWait(result);
    });
  }

  function allowLocation() {
    startAllowWait(requestDeviceGpsAttempt(undefined, ALLOW_GPS_OPTIONS));
  }

  function resumeAllowedLocationWait() {
    startAllowWait();
  }

  function skipLocation() {
    allowAbortRef.current?.abort();
    persistAllowLocationOutcome({ skip: true });
    setLocationStatus("unavailable");
    enterJournal();
  }

  if (phase === "location") {
    return (
      <section className="journal-card space-y-3 rounded-2xl p-4" data-testid="signin-location">
        <LiveLocationPrompt
          status={locationStatus}
          onAllow={allowLocation}
          onSkip={skipLocation}
          privateBrowsing={privateBrowsing}
          permission={geoPermission}
        />
      </section>
    );
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
          Create account
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
      <h2 className="font-display text-2xl text-teal">{mode === "create" ? "Create your journal" : "Sign in"}</h2>
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
          {busy ? "Working…" : mode === "create" ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="text-center text-xs text-ink-muted">
        <Link href={PRIVACY_PATH} data-testid="signin-privacy" className="font-semibold text-teal underline">
          Privacy
        </Link>
      </p>
    </section>
  );
}
