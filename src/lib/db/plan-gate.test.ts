import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createAngler } from "./anglers";
import { activateFromStorekit } from "./entitlement";
import { getDb, getSqlite, resetDbForTests } from "./index";
import { NextRequest } from "next/server";
import { PLAN_WRITE_BLOCKED } from "../plan-gate";
import { nativePlanWriteResponse } from "../plan-write-guard";
import { readPlanGate } from "./plan-gate";

describe("plan gate records", () => {
  const previousPath = process.env.DATABASE_PATH;
  const previousForce = process.env.TIDEMARK_FORCE_ENTITLEMENT;
  const previousComp = process.env.COMP_ACCOUNT_EMAILS;
  const tmpDirs: string[] = [];

  afterEach(() => {
    resetDbForTests();
    restore("DATABASE_PATH", previousPath);
    restore("TIDEMARK_FORCE_ENTITLEMENT", previousForce);
    restore("COMP_ACCOUNT_EMAILS", previousComp);
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

  it("blocks Tide Mark build 14 writes until the plan is current and leaves older shells open", async () => {
    freshJournal();
    delete process.env.COMP_ACCOUNT_EMAILS;
    const angler = await createAngler("Sam");
    const native = new NextRequest("http://localhost/api/catches", {
      method: "POST",
      headers: { "user-agent": "Mozilla/5.0 TideMarkPlanIAP/2 TideMarkBuild/14" },
    });
    const blocked = await nativePlanWriteResponse(native, angler.id);
    expect(blocked?.status).toBe(403);
    expect(await blocked?.json()).toMatchObject({ error: PLAN_WRITE_BLOCKED, locked: true });
    const older = new NextRequest("http://localhost/api/catches", {
      method: "POST",
      headers: { "user-agent": "Mozilla/5.0 TideMarkPlanIAP/2" },
    });
    expect(await nativePlanWriteResponse(older, angler.id)).toBeNull();
    const legacy = new NextRequest("http://localhost/api/catches", {
      method: "POST",
      headers: { "user-agent": "Mozilla/5.0 TideMark/1.0" },
    });
    expect(await nativePlanWriteResponse(legacy, angler.id)).toBeNull();
    const web = new NextRequest("http://localhost/api/catches", {
      method: "POST",
      headers: { "user-agent": "Mozilla/5.0" },
    });
    expect(await nativePlanWriteResponse(web, angler.id)).toBeNull();
    getSqlite().prepare("UPDATE anglers SET email = ? WHERE id = ?").run("johndavidheard2002@gmail.com", angler.id);
    expect(await nativePlanWriteResponse(native, angler.id)).toBeNull();
    getSqlite().prepare("UPDATE anglers SET email = ? WHERE id = ?").run("app-review-demo@example.com", angler.id);
    expect((await nativePlanWriteResponse(native, angler.id))?.status).toBe(403);
    getSqlite().prepare("UPDATE anglers SET email = ? WHERE id = ?").run(null, angler.id);
    await activateFromStorekit(
      angler.id,
      {
        productId: "com.tidemark.logbook.plan.annual",
        transactionId: "txn-open",
        expiresAt: "2027-10-13T00:00:00.000Z",
        source: "purchase",
      },
      new Date("2026-10-13T00:00:00.000Z"),
    );
    expect(await nativePlanWriteResponse(native, angler.id)).toBeNull();
  });
});

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
