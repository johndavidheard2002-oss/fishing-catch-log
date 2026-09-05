"use client";

import { useEffect, useState } from "react";
import {
  TRIAL_NOTICE_EVENT,
  YEARLY_PRICE_LABEL,
  localDayKey,
  trialNoticeBody,
  trialNoticeDismissKey,
  trialNoticeTitle,
  type EntitlementSnapshot,
} from "@/lib/entitlement";

function dismissed(anglerId: string, entitlement: EntitlementSnapshot): boolean {
  const noticeWindow = entitlement.noticeWindow;
  if (!noticeWindow || !anglerId) return true;
  try {
    return localStorage.getItem(trialNoticeDismissKey(anglerId, noticeWindow, localDayKey())) === "1";
  } catch {
    return false;
  }
}

function dismiss(anglerId: string, entitlement: EntitlementSnapshot) {
  const noticeWindow = entitlement.noticeWindow;
  if (!noticeWindow || !anglerId) return;
  try {
    localStorage.setItem(trialNoticeDismissKey(anglerId, noticeWindow, localDayKey()), "1");
  } catch {
    /* ignore quota / private mode */
  }
  window.dispatchEvent(new Event(TRIAL_NOTICE_EVENT));
}

function useNoticeOpen(anglerId: string, entitlement: EntitlementSnapshot | null) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function sync() {
      if (!entitlement?.noticeWindow || entitlement.subscriptionStatus !== "trial" || !anglerId) {
        setOpen(false);
        return;
      }
      setOpen(!dismissed(anglerId, entitlement));
    }
    sync();
    window.addEventListener(TRIAL_NOTICE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(TRIAL_NOTICE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [anglerId, entitlement]);

  return [open, setOpen] as const;
}

export function TrialNotice({
  anglerId,
  entitlement,
  placement,
}: {
  anglerId: string;
  entitlement: EntitlementSnapshot | null;
  placement: "home" | "nag";
}) {
  const [open, setOpen] = useNoticeOpen(anglerId, entitlement);
  const noticeWindow = entitlement?.noticeWindow;
  if (!open || !noticeWindow || !entitlement) return null;
  const compact = placement === "nag";

  return (
    <aside
      className={`journal-card space-y-2 rounded-2xl p-4 ${compact ? "border border-copper/40" : ""}`}
      data-testid={compact ? "trial-notice-nag" : "trial-notice-home"}
      data-notice-window={noticeWindow}
    >
      <p className="font-display text-lg text-teal">{trialNoticeTitle(noticeWindow)}</p>
      <p className="text-sm text-ink">{trialNoticeBody(noticeWindow)}</p>
      {!compact ? (
        <p className="text-sm font-semibold text-ink">
          After the free month, {YEARLY_PRICE_LABEL} keeps the journal unlocked. Data is never deleted.
        </p>
      ) : null}
      <button
        type="button"
        className="rounded-xl border border-line bg-card px-3 py-2 text-sm font-semibold"
        data-testid="trial-notice-dismiss"
        onClick={() => {
          dismiss(anglerId, entitlement);
          setOpen(false);
        }}
      >
        Dismiss for today
      </button>
    </aside>
  );
}

export function TrialNoticeModal({
  anglerId,
  entitlement,
}: {
  anglerId: string;
  entitlement: EntitlementSnapshot | null;
}) {
  const [open, setOpen] = useNoticeOpen(anglerId, entitlement);
  const noticeWindow = entitlement?.noticeWindow;
  if (!open || !noticeWindow || !entitlement) return null;

  return (
    <div
      className="app-fixed-overlay fixed inset-0 z-30 flex items-end justify-center bg-black/45 sm:items-center"
      data-no-tab-swipe
      data-testid="trial-notice-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-notice-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          dismiss(anglerId, entitlement);
          setOpen(false);
        }
      }}
    >
      <div className="journal-card w-full max-w-lg space-y-3 rounded-2xl p-4">
        <h2 id="trial-notice-title" className="font-display text-2xl text-teal">
          {trialNoticeTitle(noticeWindow)}
        </h2>
        <p className="text-sm text-ink">{trialNoticeBody(noticeWindow)}</p>
        <p className="text-sm font-semibold text-ink">
          {YEARLY_PRICE_LABEL} keeps Log, Calendar, and the rest unlocked. Nothing is deleted if the trial ends.
        </p>
        <button
          type="button"
          className="w-full rounded-2xl bg-teal px-4 py-3 font-semibold text-white"
          data-testid="trial-notice-modal-dismiss"
          onClick={() => {
            dismiss(anglerId, entitlement);
            setOpen(false);
          }}
        >
          Got it — remind me later
        </button>
      </div>
    </div>
  );
}
