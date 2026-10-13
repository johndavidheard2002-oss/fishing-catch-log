import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { registerJournal } from "../auth";
import { PLAN_GRANDFATHER_BEFORE_DEFAULT } from "../plan-gate";
import { createAngler } from "./anglers";
import { activateFromStorekit } from "./entitlement";
import { getDb, getSqlite, resetDbForTests } from "./index";
import { readPlanGate } from "./plan-gate";

describe("plan gate records", () => {
  const previousPath = process.env.DATABASE_PATH;
  const previousForce = process.env.TIDEMARK_FORCE_ENTITLEMENT;
  const previousGrandfather = process.env.TIDEMARK_PLAN_GRANDFATHER;
  const previousCutoff = process.env.TIDEMARK_PLAN_GRANDFATHER_BEFORE;
  const previousReview = process.env.TIDEMARK_PLAN_REVIEW_EMAILS;
  const tmpDirs: string[] = [];

  afterEach(() => {
    resetDbForTests();
    restore("DATABASE_PATH", previousPath);
    restore("TIDEMARK_FORCE_ENTITLEMENT", previousForce);
    restore("TIDEMARK_PLAN_GRANDFATHER", previousGrandfather);
    restore("TIDEMARK_PLAN_GRANDFATHER_BEFORE", previousCutoff);
    restore("TIDEMARK_PLAN_REVIEW_EMAILS", previousReview);
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  function freshJournal() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-plan-gate-"));
    tmpDirs.push(dir);
    process.env.DATABASE_PATH = path.join(dir, "journal.sqlite");
    delete process.env.TIDEMARK_FORCE_ENTITLEMENT;
    delete process.env.TIDEMARK_PLAN_GRANDFATHER;
    delete process.env.TIDEMARK_PLAN_GRANDFATHER_BEFORE;
    delete process.env.TIDEMARK_PLAN_REVIEW_EMAILS;
    resetDbForTests();
    getDb();
  }

  function insertCatch(anglerId: string, createdAt: string) {
    getSqlite()
      .prepare(
        `INSERT INTO catches (
          id, species, species_source, caught_at, time_of_day, season, habitat, fish_count,
          angler_id, shared_with_linked, created_at, updated_at
        ) VALUES (?, 'Redfish', 'manual', ?, 'morning', 'fall', 'saltwater-inshore', 1, ?, 0, ?, ?)`,
      )
      .run(`catch-${createdAt}`, createdAt, anglerId, createdAt, createdAt);
  }

  it("grandfathers only accounts with a catch from before the cutoff", async () => {
    freshJournal();
    const older = await createAngler("Pat");
    const newer = await createAngler("Sam");
    insertCatch(older.id, "2026-09-01T12:00:00.000Z");
    insertCatch(newer.id, "2026-10-13T18:00:00.000Z");
    expect((await readPlanGate(older.id)).grandfathered).toBe(true);
    expect((await readPlanGate(newer.id)).grandfathered).toBe(false);
    expect((await readPlanGate(newer.id)).subscribed).toBe(false);
    process.env.TIDEMARK_PLAN_GRANDFATHER = "0";
    expect((await readPlanGate(older.id)).grandfathered).toBe(false);
  });

  it("keeps a review account on the paywall and unlocks a stored Plan term", async () => {
    freshJournal();
    const review = await registerJournal({
      name: "Review",
      email: "review@example.com",
      password: "password1",
      confirm: "password1",
    });
    expect(review.ok).toBe(true);
    if (!review.ok) return;
    insertCatch(review.angler.id, "2026-09-01T12:00:00.000Z");
    process.env.TIDEMARK_PLAN_REVIEW_EMAILS = "review@example.com";
    const gated = await readPlanGate(review.angler.id);
    expect(gated.grandfathered).toBe(false);
    expect(gated.subscribed).toBe(false);
    const activated = await activateFromStorekit(
      review.angler.id,
      {
        productId: "com.tidemark.logbook.plan.annual",
        transactionId: "txn-review",
        expiresAt: "2027-10-13T00:00:00.000Z",
        source: "purchase",
      },
      new Date("2026-10-13T00:00:00.000Z"),
    );
    expect("entitlement" in activated).toBe(true);
    const open = await readPlanGate(review.angler.id, new Date("2026-10-13T00:00:00.000Z"));
    expect(open.subscribed).toBe(true);
    expect(PLAN_GRANDFATHER_BEFORE_DEFAULT).toBe("2026-10-13T12:00:00.000Z");
  });
});

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
