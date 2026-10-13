import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createAngler } from "./anglers";
import { activateFromStorekit } from "./entitlement";
import { getDb, getSqlite, resetDbForTests } from "./index";
import { readPlanGate } from "./plan-gate";

describe("plan gate records", () => {
  const previousPath = process.env.DATABASE_PATH;
  const previousForce = process.env.TIDEMARK_FORCE_ENTITLEMENT;
  const tmpDirs: string[] = [];

  afterEach(() => {
    resetDbForTests();
    restore("DATABASE_PATH", previousPath);
    restore("TIDEMARK_FORCE_ENTITLEMENT", previousForce);
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  function freshJournal() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-plan-gate-"));
    tmpDirs.push(dir);
    process.env.DATABASE_PATH = path.join(dir, "journal.sqlite");
    delete process.env.TIDEMARK_FORCE_ENTITLEMENT;
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

  it("marks any logged catch and does not unlock the rest of the app", async () => {
    freshJournal();
    const empty = await createAngler("Sam");
    const logged = await createAngler("Pat");
    insertCatch(logged.id, "2026-10-13T18:00:00.000Z");
    expect((await readPlanGate(empty.id)).hasCatches).toBe(false);
    expect((await readPlanGate(empty.id)).subscribed).toBe(false);
    expect((await readPlanGate(logged.id)).hasCatches).toBe(true);
    expect((await readPlanGate(logged.id)).subscribed).toBe(false);
  });

  it("unlocks a stored Plan term without dropping the catch flag", async () => {
    freshJournal();
    const angler = await createAngler("Pat");
    insertCatch(angler.id, "2026-09-01T12:00:00.000Z");
    const activated = await activateFromStorekit(
      angler.id,
      {
        productId: "com.tidemark.logbook.plan.annual",
        transactionId: "txn-review",
        expiresAt: "2027-10-13T00:00:00.000Z",
        source: "purchase",
      },
      new Date("2026-10-13T00:00:00.000Z"),
    );
    expect("entitlement" in activated).toBe(true);
    const open = await readPlanGate(angler.id, new Date("2026-10-13T00:00:00.000Z"));
    expect(open.subscribed).toBe(true);
    expect(open.hasCatches).toBe(true);
  });
});

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
