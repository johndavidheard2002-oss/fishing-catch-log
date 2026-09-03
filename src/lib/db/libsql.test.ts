import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCatch, getCatch, listCatches } from "./catches";
import { ensureDb, resetDbForTests } from "./index";
import { seedDefaultAngler } from "./anglers";
import { databaseConfig } from "./config";

describe("LibSQL / Turso path (local file: smoke)", () => {
  const previous = {
    DATABASE_PATH: process.env.DATABASE_PATH,
    DATABASE_URL: process.env.DATABASE_URL,
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
  };
  const tmpDirs: string[] = [];

  afterEach(() => {
    resetDbForTests();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  it("opens a file: LibSQL journal, migrates, and can log a catch", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-libsql-"));
    tmpDirs.push(dir);
    const libsqlFile = path.join(dir, "journal.db");
    delete process.env.DATABASE_PATH;
    delete process.env.DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
    process.env.TURSO_DATABASE_URL = `file:${libsqlFile}`;
    resetDbForTests();

    expect(databaseConfig().mode).toBe("libsql");
    expect(databaseConfig().libsqlUrl).toBe(`file:${libsqlFile}`);

    await ensureDb();
    expect(await listCatches()).toHaveLength(0);

    const owner = await seedDefaultAngler();
    const created = await createCatch({
      species: "Redfish",
      latitude: 28.74,
      longitude: -80.75,
      placeName: "Mosquito Lagoon",
      caughtAt: "2026-08-02T15:00:00.000Z",
      habitat: "saltwater-inshore",
      photoPath: "https://example.com/catches/redfish.jpg",
      anglerId: owner.id,
    });
    expect(created.id).toBeTruthy();
    expect(created.photoPath).toBe("https://example.com/catches/redfish.jpg");

    const listed = await listCatches({ viewerId: owner.id });
    expect(listed).toHaveLength(1);
    expect(listed[0].placeName).toBe("Mosquito Lagoon");
    expect((await getCatch(created.id))?.species).toBe("Redfish");
  });
});
