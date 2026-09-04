import { afterEach, describe, expect, it } from "vitest";
import {
  YEARLY_PRICE_LABEL,
  buildEntitlement,
  computeSubscriptionStatus,
  isJournalLockedPath,
  journalUnlocked,
  localDayKey,
  paywallCopy,
  trialDurationMs,
  trialNoticeBody,
  trialNoticeDismissKey,
  trialNoticeWindow,
} from "./entitlement";

describe("entitlement clock", () => {
  const start = "2026-09-01T12:00:00.000Z";

  it("keeps a new journal on trial for 30 days", () => {
    const now = new Date("2026-09-15T12:00:00.000Z");
    expect(
      computeSubscriptionStatus({
        now,
        trialStartedAt: start,
        storedStatus: "trial",
        durationMs: 30 * 24 * 60 * 60 * 1000,
      }),
    ).toBe("trial");
    const snap = buildEntitlement({
      now,
      trialStartedAt: start,
      storedStatus: "trial",
      durationMs: 30 * 24 * 60 * 60 * 1000,
    });
    expect(snap.subscriptionStatus).toBe("trial");
    expect(snap.daysRemaining).toBe(16);
    expect(snap.noticeWindow).toBeNull();
    expect(snap.yearlyPrice).toBe(YEARLY_PRICE_LABEL);
    expect(journalUnlocked(snap.subscriptionStatus)).toBe(true);
  });

  it("expires the moment the 30-day clock elapses", () => {
    const now = new Date("2026-10-01T12:00:00.000Z");
    expect(
      computeSubscriptionStatus({
        now,
        trialStartedAt: start,
        storedStatus: "trial",
        durationMs: 30 * 24 * 60 * 60 * 1000,
      }),
    ).toBe("expired");
    const snap = buildEntitlement({
      now,
      trialStartedAt: start,
      storedStatus: "trial",
      durationMs: 30 * 24 * 60 * 60 * 1000,
    });
    expect(snap.subscriptionStatus).toBe("expired");
    expect(snap.daysRemaining).toBe(0);
    expect(snap.noticeWindow).toBeNull();
    expect(journalUnlocked(snap.subscriptionStatus)).toBe(false);
  });

  it("honors a paid active entitlement and an explicit expired row", () => {
    expect(
      computeSubscriptionStatus({
        now: new Date("2027-01-01T00:00:00.000Z"),
        trialStartedAt: start,
        storedStatus: "active",
      }),
    ).toBe("active");
    expect(
      computeSubscriptionStatus({
        now: new Date("2026-09-02T00:00:00.000Z"),
        trialStartedAt: start,
        storedStatus: "expired",
      }),
    ).toBe("expired");
    expect(
      computeSubscriptionStatus({
        now: new Date("2026-12-01T00:00:00.000Z"),
        trialStartedAt: start,
        storedStatus: "active",
        subscriptionExpiresAt: "2026-11-01T00:00:00.000Z",
      }),
    ).toBe("expired");
  });

  it("lets a force flag override the clock for QA", () => {
    expect(
      computeSubscriptionStatus({
        now: new Date("2026-09-02T00:00:00.000Z"),
        trialStartedAt: start,
        storedStatus: "trial",
        forceStatus: "expired",
      }),
    ).toBe("expired");
  });
});

describe("trial notices", () => {
  const day = 24 * 60 * 60 * 1000;

  it("opens 7-day, 3-day, and 1-day windows and stays off otherwise", () => {
    expect(trialNoticeWindow(8 * day)).toBeNull();
    expect(trialNoticeWindow(7 * day)).toBe("7d");
    expect(trialNoticeWindow(3.5 * day)).toBe("7d");
    expect(trialNoticeWindow(3 * day)).toBe("3d");
    expect(trialNoticeWindow(1.5 * day)).toBe("3d");
    expect(trialNoticeWindow(day)).toBe("1d");
    expect(trialNoticeWindow(0.5 * day)).toBe("1d");
    expect(trialNoticeWindow(0)).toBeNull();
  });

  it("uses a per-window per-day dismiss key so later windows return", () => {
    expect(trialNoticeDismissKey("a1", "7d", "2026-09-24")).toBe(
      "tidemark-trial-notice:a1:7d:2026-09-24",
    );
    expect(trialNoticeDismissKey("a1", "3d", "2026-09-28")).not.toBe(
      trialNoticeDismissKey("a1", "7d", "2026-09-24"),
    );
    expect(localDayKey(new Date(2026, 8, 4))).toBe("2026-09-04");
  });

  it("names Tide Mark, the yearly price, and that data stays", () => {
    const body = trialNoticeBody("7d");
    expect(body).toContain("Tide Mark");
    expect(body).toContain(YEARLY_PRICE_LABEL);
    expect(body.toLowerCase()).toContain("safe");
    expect(body.toLowerCase()).not.toContain("catch compass");
    const copy = paywallCopy();
    expect(copy.brand).toBe("Tide Mark");
    expect(copy.subtitle).toBe("Private saltwater logbook");
    expect(copy.yearlyPrice).toBe(YEARLY_PRICE_LABEL);
    expect(copy.body).toContain("nothing was deleted");
    expect(copy.storeNote).toContain("App Store");
  });
});

describe("locked journal paths", () => {
  it("never locks Home or privacy, and locks every journal tab", () => {
    expect(isJournalLockedPath("/")).toBe(false);
    expect(isJournalLockedPath("/privacy")).toBe(false);
    expect(isJournalLockedPath("/signin")).toBe(false);
    expect(isJournalLockedPath("/log")).toBe(true);
    expect(isJournalLockedPath("/log/scan")).toBe(true);
    expect(isJournalLockedPath("/calendar")).toBe(true);
    expect(isJournalLockedPath("/history")).toBe(true);
    expect(isJournalLockedPath("/spots")).toBe(true);
    expect(isJournalLockedPath("/plan")).toBe(true);
    expect(isJournalLockedPath("/backfill")).toBe(true);
    expect(isJournalLockedPath("/catch/abc")).toBe(true);
    expect(isJournalLockedPath("/bait/new")).toBe(true);
    expect(isJournalLockedPath("/bait/xyz")).toBe(true);
  });
});

describe("trial duration env", () => {
  const previous = process.env.TIDEMARK_TRIAL_DAYS;

  afterEach(() => {
    if (previous === undefined) delete process.env.TIDEMARK_TRIAL_DAYS;
    else process.env.TIDEMARK_TRIAL_DAYS = previous;
  });

  it("defaults to 30 days and accepts a short QA length", () => {
    expect(trialDurationMs({})).toBe(30 * 24 * 60 * 60 * 1000);
    expect(trialDurationMs({ TIDEMARK_TRIAL_DAYS: "0.5" })).toBe(0.5 * 24 * 60 * 60 * 1000);
    expect(trialDurationMs({ TIDEMARK_TRIAL_DAYS: "nope" })).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
