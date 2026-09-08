import {
  MANUAL_ENTRY_AFTER_RECONNECT,
  OFFLINE_LOG_SAVED,
  WAITING_FOR_SERVICE_CHIP,
} from "@/lib/offline";

export function WaitingForServiceChip({ className = "" }: { className?: string }) {
  return (
    <span
      data-testid="waiting-for-service"
      className={`rounded-full bg-copper/15 px-2 py-0.5 text-[10px] font-semibold text-copper ${className}`}
    >
      {WAITING_FOR_SERVICE_CHIP}
    </span>
  );
}

export function OfflineLogSavedNote() {
  return (
    <p
      data-testid="offline-log-saved"
      className="rounded-2xl border border-copper bg-paper-deep px-3 py-2 text-sm font-medium text-ink"
    >
      {OFFLINE_LOG_SAVED}
    </p>
  );
}

export function ManualEntryAfterReconnectNote() {
  return (
    <p
      data-testid="manual-entry-after-reconnect"
      className="rounded-2xl border border-copper bg-paper-deep px-3 py-2 text-sm font-medium text-ink"
    >
      {MANUAL_ENTRY_AFTER_RECONNECT}
    </p>
  );
}
