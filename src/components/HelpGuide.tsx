"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  HELP_OPEN_EVENT,
  HELP_SECTIONS,
  helpTipSeen,
  markHelpTipSeen,
  subscribeHelpTip,
} from "@/lib/help";
import { AUTH_CHANGE_EVENT, openTour, subscribeTour, tourSeen } from "@/lib/tour";
import { APP_DISPLAY_NAME } from "@/lib/brand";

export function HelpButton() {
  return (
    <button
      type="button"
      data-testid="help-open"
      aria-label="Help"
      onClick={() => window.dispatchEvent(new Event(HELP_OPEN_EVENT))}
      className="shrink-0 rounded-full border border-line bg-card px-2 py-0.5 text-xs font-semibold text-ink"
    >
      Help
    </button>
  );
}

export function HelpGuide() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onOpen() {
      markHelpTipSeen();
      setOpen(true);
    }
    window.addEventListener(HELP_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(HELP_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 px-3 pb-36 pt-8 sm:items-center sm:pb-8"
      data-no-tab-swipe
      data-testid="help-guide"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-guide-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="journal-card flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl">
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
          <div>
            <h2 id="help-guide-title" className="font-display text-2xl text-teal">
              How to use {APP_DISPLAY_NAME}
            </h2>
            <p className="text-sm text-ink-muted">Saltwater Logbook — short steps, anytime.</p>
          </div>
          <button
            type="button"
            data-testid="help-close"
            onClick={() => setOpen(false)}
            className="rounded-full border border-line bg-card px-2.5 py-1 text-xs font-semibold"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
          {HELP_SECTIONS.map((section) => (
            <section key={section.title} className="rounded-2xl bg-paper-deep/50 px-3 py-2.5">
              <h3 className="font-semibold text-ink">{section.title}</h3>
              <ol className="mt-1 list-decimal space-y-1 pl-4 text-sm text-ink">
                {section.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
          ))}
          <div className="rounded-2xl border border-line bg-card px-3 py-3">
            <p className="font-semibold text-ink">How this works</p>
            <p className="mt-0.5 text-sm text-ink-muted">
              Replay the short tour — Log, Calendar Log, Plan, Backfill, and sharing with a friend.
            </p>
            <button
              type="button"
              data-testid="help-open-tour"
              data-help-open-setup="help-open-setup"
              id="help-open-setup"
              onClick={() => {
                setOpen(false);
                openTour();
              }}
              className="mt-2 w-full rounded-2xl bg-copper px-4 py-2.5 font-semibold text-white"
            >
              Show how this works
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FirstHelpTip() {
  const [anglerId, setAnglerId] = useState("");
  useEffect(() => {
    function loadMe() {
      fetch("/api/me", { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          if (typeof data.me?.id === "string") setAnglerId(data.me.id);
        })
        .catch(() => {});
    }
    loadMe();
    window.addEventListener(AUTH_CHANGE_EVENT, loadMe);
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, loadMe);
  }, []);
  const tourDone = useSyncExternalStore(
    subscribeTour,
    () => (anglerId ? tourSeen(anglerId) : false),
    () => false,
  );
  const unseen = useSyncExternalStore(subscribeHelpTip, () => !helpTipSeen(), () => false);
  if (!tourDone || !unseen) return null;

  return (
    <div className="journal-card flex items-center justify-between gap-2 rounded-2xl px-3 py-2" data-testid="help-first-tip">
      <p className="text-sm text-ink">New here? Tap Help at the top anytime.</p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          className="rounded-full bg-teal px-3 py-1 text-xs font-semibold text-white"
          onClick={() => {
            markHelpTipSeen();
            window.dispatchEvent(new Event(HELP_OPEN_EVENT));
          }}
        >
          Open
        </button>
        <button
          type="button"
          className="text-xs font-semibold text-ink-muted"
          onClick={() => markHelpTipSeen()}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
