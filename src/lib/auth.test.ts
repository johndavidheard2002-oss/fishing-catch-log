import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCatch, listCatches } from "./db/catches";
import { getAngler, seedDefaultAngler } from "./db/anglers";
import { getDb, resetDbForTests } from "./db/index";
import {
  AUTH_WRONG,
  hashPassword,
  loginJournal,
  normalizeEmail,
  readSession,
  registerJournal,
  signSession,
  verifyPassword,
} from "./auth";

describe("email + password journals", () => {
  const previousPath = process.env.DATABASE_PATH;
  const tmpDirs: string[] = [];

  afterEach(() => {
    resetDbForTests();
    if (previousPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previousPath;
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  function freshJournal() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-auth-"));
    tmpDirs.push(dir);
    process.env.DATABASE_PATH = path.join(dir, "journal.sqlite");
    resetDbForTests();
    getDb();
  }

  it("hashes with scrypt and verifies only the matching password", async () => {
    const stored = await hashPassword("correct-horse");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct-horse", stored)).toBe(true);
    expect(await verifyPassword("wrong-battery", stored)).toBe(false);
  });

  it("normalizes email and signs a session that reads back", () => {
    expect(normalizeEmail(" John@Gulf.COM ")).toBe("john@gulf.com");
    const token = signSession("angler-1");
    expect(token.split(".")).toHaveLength(3);
    expect(readSession(token)).toBe("angler-1");
    expect(readSession("nope")).toBeNull();
  });

  it("never claims a leftover unclaimed journal — create account starts empty", async () => {
    freshJournal();
    const john = await seedDefaultAngler();
    await createCatch({
      species: "Redfish",
      latitude: 28.74,
      longitude: -80.75,
      placeName: "Mosquito Lagoon",
      caughtAt: "2026-08-02T15:00:00.000Z",
      anglerId: john.id,
    });
    const result = await registerJournal({
      name: "John",
      email: "john@gulf.com",
      password: "redfish12",
      confirm: "redfish12",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.angler.id).not.toBe(john.id);
    expect(result.angler.email).toBe("john@gulf.com");
    expect(result.angler.claimed).toBe(true);
    const leftover = await listCatches({ viewerId: john.id });
    expect(leftover).toHaveLength(1);
    expect(leftover[0].placeName).toBe("Mosquito Lagoon");
    const mine = await listCatches({ viewerId: result.angler.id });
    expect(mine).toHaveLength(0);
  });

  it("does not put two people on the same email", async () => {
    freshJournal();
    const first = await registerJournal({
      name: "A",
      email: "pat@gulf.com",
      password: "password1",
      confirm: "password1",
    });
    expect(first.ok).toBe(true);
    const second = await registerJournal({
      name: "B",
      email: "PAT@gulf.com",
      password: "password2",
      confirm: "password2",
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error).toMatch(/already has a journal/i);
  });

  it("logs in with email and rejects a wrong password with a generic error", async () => {
    freshJournal();
    await registerJournal({
      name: "Pat",
      email: "pat@gulf.com",
      password: "password1",
      confirm: "password1",
    });
    const ok = await loginJournal({ email: "pat@gulf.com", password: "password1", ip: "1.1.1.1" });
    expect(ok.ok).toBe(true);
    const bad = await loginJournal({ email: "pat@gulf.com", password: "nope-nope", ip: "1.1.1.1" });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.error).toBe(AUTH_WRONG);
    const missing = await loginJournal({ email: "nobody@gulf.com", password: "password1", ip: "1.1.1.1" });
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error).toBe(AUTH_WRONG);
  });

  it("keeps two signed-in journals separate", async () => {
    freshJournal();
    const regA = await registerJournal({
      name: "A",
      email: "a@gulf.com",
      password: "password1",
      confirm: "password1",
    });
    const regB = await registerJournal({
      name: "B",
      email: "b@gulf.com",
      password: "password2",
      confirm: "password2",
    });
    expect(regA.ok && regB.ok).toBe(true);
    if (!regA.ok || !regB.ok) return;
    await createCatch({
      species: "Redfish",
      latitude: 28.7,
      longitude: -80.7,
      placeName: "A hole",
      caughtAt: "2026-08-02T15:00:00.000Z",
      anglerId: regA.angler.id,
    });
    const aList = await listCatches({ viewerId: regA.angler.id });
    const bList = await listCatches({ viewerId: regB.angler.id });
    expect(aList.map((c) => c.placeName)).toEqual(["A hole"]);
    expect(bList).toHaveLength(0);
    expect((await getAngler(regA.angler.id, { includeEmail: true }))?.email).toBe("a@gulf.com");
  });

  it("creates a new claimed journal when there is no leftover unclaimed cookie", async () => {
    freshJournal();
    const result = await registerJournal({
      name: "Pat",
      email: "pat@gulf.com",
      password: "password1",
      confirm: "password1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.angler.email).toBe("pat@gulf.com");
    expect(result.angler.claimed).toBe(true);
  });
});
