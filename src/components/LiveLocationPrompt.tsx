"use client";

import {
  ALLOW_LOCATION_LABEL,
  GETTING_LOCATION_LABEL,
  skipLocationLabel,
  liveLocationPromptCopy,
  type LiveLocationStatus,
} from "@/lib/location";

export function LiveLocationPrompt({
  status,
  onAllow,
  onSkip,
}: {
  status: LiveLocationStatus;
  onAllow: () => void;
  onSkip: () => void;
}) {
  const copy = liveLocationPromptCopy(status);
  const waiting = status === "asking";

  return (
    <div
      data-testid="live-location-prompt"
      className="rounded-2xl border border-line bg-card px-3 py-3"
    >
      <p className="text-[15px] font-semibold text-ink">{copy.title}</p>
      <p className="mt-1.5 text-[15px] leading-snug text-ink">{copy.body}</p>
      {status === "ready" ? null : waiting ? (
        <div className="mt-2.5 space-y-2">
          <button
            type="button"
            data-testid="allow-location"
            disabled
            className="w-full rounded-xl bg-teal py-3 text-base font-semibold text-white disabled:opacity-60"
          >
            {GETTING_LOCATION_LABEL}
          </button>
          <button
            type="button"
            data-testid="skip-location"
            onClick={onSkip}
            className="w-full rounded-xl bg-copper py-3 text-base font-semibold text-white"
          >
            {skipLocationLabel(status)}
          </button>
        </div>
      ) : (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="allow-location"
            onClick={onAllow}
            className="rounded-xl bg-teal py-3 text-base font-semibold text-white"
          >
            {ALLOW_LOCATION_LABEL}
          </button>
          {status === "unavailable" ? (
            <span className="self-center text-sm text-ink-muted">Or drop a pin by hand.</span>
          ) : (
            <button
              type="button"
              data-testid="skip-location"
              onClick={onSkip}
              className="rounded-xl border border-line bg-paper py-3 text-base font-semibold text-ink"
            >
              {skipLocationLabel(status)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
