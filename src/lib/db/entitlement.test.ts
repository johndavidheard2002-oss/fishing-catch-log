import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { registerJournal } from "../auth";
import { getDb, getSqlite, resetDbForTests } from "./index";
import { activateFromStorekit, ensureTrialStarted, getEntitlementForAngler, setStoredSubscription } from "./entitlement";
import { createAngler } from "./anglers";

describe("persisted entitlement", () => {
  const previousPath = process.env.DATABASE_PATH;
  const previousForce = process.env.TIDEMARK_FORCE_ENTITLEMENT;
  const tmpDirs: string[] = [];

  afterEach(() => {
    resetDbForTests();
    if (previousPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previousPath;
    if (previousForce === undefined) delete process.env.TIDEMARK_FORCE_ENTITLEMENT;
    else process.env.TIDEMARK_FORCE_ENTITLEMENT = previousForce;
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  function freshJournal() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-entitlement-"));
    tmpDirs.push(dir);
    process.env.DATABASE_PATH = path.join(dir, "journal.sqlite");
    delete process.env.TIDEMARK_FORCE_ENTITLEMENT;
    resetDbForTests();
    getDb();
  }

  it("starts the trial once and does not reset on a later ensure", async () => {
    freshJournal();
    const created = await createAngler("Pat");
    const first = await ensureTrialStarted(created.id, new Date("2026-09-01T12:00:00.000Z"));
    const again = await ensureTrialStarted(created.id, new Date("2026-09-20T12:00:00.000Z"));
    expect(again).toBe(first);
    const snap = await getEntitlementForAngler(created.id, new Date("2026-09-10T12:00:00.000Z"));
    expect(snap?.subscriptionStatus).toBe("trial");
    expect(snap?.trialStartedAt).toBe(first);
  });

  it("lets QA mark a journal expired without deleting rows", async () => {
    freshJournal();
    const created = await createAngler("Pat");
    await ensureTrialStarted(created.id);
    const expired = await setStoredSubscription(created.id, { status: "expired" });
    expect(expired?.subscriptionStatus).toBe("expired");
    const row = getSqlite()
      .prepare("SELECT trial_started_at, subscription_status FROM anglers WHERE id = ?")
      .get(created.id) as { trial_started_at: string; subscription_status: string };
    expect(row.trial_started_at).toBeTruthy();
    expect(row.subscription_status).toBe("expired");
  });

  it("marks a journal active from a StoreKit purchase without moving the trial clock", async () => {
    freshJournal();
    const created = await createAngler("Pat");
    const trialStart = await ensureTrialStarted(created.id, new Date("2026-09-01T12:00:00.000Z"));
    const result = await activateFromStorekit(
      created.id,
      {
        productId: "tidemark_premium_yearly",
        transactionId: "txn-db",
        source: "purchase",
      },
      new Date("2026-09-10T12:00:00.000Z"),
    );
    expect("entitlement" in result).toBe(true);
    if (!("entitlement" in result)) return;
    expect(result.entitlement.subscriptionStatus).toBe("active");
    expect(result.entitlement.trialStartedAt).toBe(trialStart);
    const again = await getEntitlementForAngler(created.id, new Date("2026-10-15T12:00:00.000Z"));
    expect(again?.subscriptionStatus).toBe("active");
    expect(again?.trialStartedAt).toBe(trialStart);
  });

  it("restores an expired App Store term as expired and rejects the wrong product", async () => {
    freshJournal();
    const created = await createAngler("Pat");
    await ensureTrialStarted(created.id);
    const restored = await activateFromStorekit(
      created.id,
      {
        productId: "tidemark_premium_yearly",
        transactionId: "txn-old",
        expiresAt: "2026-01-01T00:00:00.000Z",
        source: "restore",
      },
      new Date("2026-09-05T00:00:00.000Z"),
    );
    expect("entitlement" in restored).toBe(true);
    if ("entitlement" in restored) {
      expect(restored.entitlement.subscriptionStatus).toBe("expired");
    }
    const wrong = await activateFromStorekit(created.id, {
      productId: "com.other.premium",
      transactionId: "txn-x",
      source: "purchase",
    });
    expect("error" in wrong).toBe(true);
    if ("error" in wrong) expect(wrong.error).toContain("tidemark_premium_yearly");
  });

  it("registers a claimed journal already on trial", async () => {
    freshJournal();
    const result = await registerJournal({
      name: "John",
      email: "john@gulf.com",
      password: "redfish12",
      confirm: "redfish12",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const snap = await getEntitlementForAngler(result.angler.id);
    expect(snap?.subscriptionStatus).toBe("trial");
    expect(snap?.trialStartedAt).toBeTruthy();
  });
});
