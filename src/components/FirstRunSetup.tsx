"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { markHelpTipSeen } from "@/lib/help";
import { SETUP_OPEN_EVENT } from "@/lib/setup";
import { APP_DISPLAY_NAME, APP_SUBTITLE } from "@/lib/brand";
import {
  AUTH_CHANGE_EVENT,
  TOUR_OPEN_EVENT,
  TOUR_SCREENS,
  markTourSeen,
  shouldShowTour,
  subscribeTour,
  tourSeen,
} from "@/lib/tour";

function subscribeNever() {
  return () => {};
}

export function FirstRunSetup() {
  const ready = useSyncExternalStore(subscribeNever, () => true, () => false);
  const [anglerId, setAnglerId] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const seen = useSyncExternalStore(
    subscribeTour,
    () => (anglerId ? tourSeen(anglerId) : true),
    () => true,
  );
  const [forced, setForced] = useState(false);
  const [step, setStep] = useState(0);
  const [pendingSeen, setPendingSeen] = useState(false);

  useEffect(() => {
    function loadMe() {
      fetch("/api/me", { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          setAnglerId(typeof data.me?.id === "string" ? data.me.id : "");
          setSignedIn(Boolean(data.signedIn));
        })
        .catch(() => {
          setAnglerId("");
          setSignedIn(false);
        });
    }
    loadMe();
    window.addEventListener(AUTH_CHANGE_EVENT, loadMe);
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, loadMe);
  }, []);

  useEffect(() => {
    function onOpen() {
      setStep(0);
      setForced(true);
    }
    window.addEventListener(TOUR_OPEN_EVENT, onOpen);
    window.addEventListener(SETUP_OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener(TOUR_OPEN_EVENT, onOpen);
      window.removeEventListener(SETUP_OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!pendingSeen || !anglerId || !signedIn) return;
    markTourSeen(anglerId);
    setPendingSeen(false);
  }, [pendingSeen, anglerId, signedIn]);

  if (!shouldShowTour({ ready, seen, forced, signedIn })) return null;

  const screen = TOUR_SCREENS[step] ?? TOUR_SCREENS[0];
  const last = step >= TOUR_SCREENS.length - 1;

  function finish() {
    if (signedIn && anglerId) markTourSeen(anglerId);
    else if (signedIn) setPendingSeen(true);
    markHelpTipSeen();
    setForced(false);
    setStep(0);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-3 pb-6 pt-8 sm:items-center"
      data-no-tab-swipe
      data-testid="first-run-setup"
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-run-title"
    >
      <div className="journal-card flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pt-5 pb-4">
          <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            {APP_DISPLAY_NAME} · {APP_SUBTITLE}
          </p>
          <p className="text-xs font-semibold text-ink-muted" data-testid="tour-progress">
            {step + 1} of {TOUR_SCREENS.length}
          </p>
          <h2 id="first-run-title" className="font-display text-3xl text-teal">
            {screen.title}
          </h2>
          <p className="text-sm text-ink">{screen.body}</p>
          <div className="flex justify-center gap-1.5 pt-1" aria-hidden>
            {TOUR_SCREENS.map((item, index) => (
              <span
                key={item.id}
                className={`h-2 w-2 rounded-full ${index === step ? "bg-teal" : "bg-line"}`}
              />
            ))}
          </div>
          {last ? (
            <button
              type="button"
              data-testid="tour-done"
              onClick={finish}
              className="w-full rounded-2xl bg-copper px-4 py-3 text-lg font-semibold text-white"
            >
              Got it
            </button>
          ) : (
            <button
              type="button"
              data-testid="tour-next"
              onClick={() => setStep((current) => Math.min(current + 1, TOUR_SCREENS.length - 1))}
              className="w-full rounded-2xl bg-copper px-4 py-3 text-lg font-semibold text-white"
            >
              Next
            </button>
          )}
          {step > 0 ? (
            <button
              type="button"
              data-testid="tour-back"
              onClick={() => setStep((current) => Math.max(current - 1, 0))}
              className="w-full rounded-2xl border-2 border-line bg-card px-4 py-3 font-semibold text-ink"
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            data-testid="setup-skip"
            onClick={finish}
            className="w-full rounded-2xl border-2 border-line bg-card px-4 py-3 font-semibold text-ink"
          >
            Skip / Do later
          </button>
          <p className="text-center text-xs text-ink-muted">
            Open Help anytime to see this again.
          </p>
        </div>
      </div>
    </div>
  );
}
