import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient, type InStatement } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";
import { createCatch, getCatch, listCatches } from "./catches";
import { ensureDb, migrateLibsql, resetDbForTests, SCHEMA_VERSION } from "./index";
import { seedDefaultAngler } from "./anglers";
import { databaseConfig } from "./config";

function statementSql(stmt: InStatement | string): string {
  return typeof stmt === "string" ? stmt : stmt.sql;
}

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

  it("migrates via schema_meta and never writes PRAGMA user_version", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-libsql-mig-"));
    tmpDirs.push(dir);
    const client = createClient({ url: `file:${path.join(dir, "journal.db")}` });
    const sqls: string[] = [];
    const execute = client.execute.bind(client);
    const executeMultiple = client.executeMultiple.bind(client);
    client.execute = ((stmt: InStatement | string) => {
      sqls.push(statementSql(stmt));
      return execute(stmt);
    }) as typeof client.execute;
    client.executeMultiple = ((sql: string) => {
      sqls.push(sql);
      return executeMultiple(sql);
    }) as typeof client.executeMultiple;

    await migrateLibsql(client);
    await migrateLibsql(client);

    expect(sqls.some((sql) => /PRAGMA\s+user_version\s*=/i.test(sql))).toBe(false);
    expect(sqls.some((sql) => /CREATE TABLE IF NOT EXISTS schema_meta/i.test(sql))).toBe(true);

    const version = await execute({
      sql: "SELECT value FROM schema_meta WHERE key = ?",
      args: ["schema_version"],
    });
    const row = version.rows[0] as unknown as Record<string, unknown> | undefined;
    expect(String(row?.value ?? row?.[0] ?? "")).toBe(String(SCHEMA_VERSION));

    const tables = await execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('catches', 'anglers', 'bait_spots', 'schema_meta')",
    );
    const names = tables.rows.map((r) => String((r as unknown as Record<string, unknown>).name ?? r[0]));
    expect(names).toEqual(expect.arrayContaining(["catches", "anglers", "bait_spots", "schema_meta"]));
    client.close();
  });

  it("purges sample /seed/ rows when schema_meta is already 11", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-libsql-v12-"));
    tmpDirs.push(dir);
    const client = createClient({ url: `file:${path.join(dir, "journal.db")}` });
    await migrateLibsql(client);
    await client.execute({
      sql: "INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)",
      args: ["schema_version", "11"],
    });
    const stamp = "2026-09-03T12:00:00.000Z";
    await client.execute({
      sql: `INSERT INTO catches (
        id, photo_path, species, species_source, caught_at, time_of_day, season,
        habitat, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: ["seed-1", "/seed/rainbow.svg", "Brown Trout", "demo", stamp, "afternoon", "summer", "freshwater", stamp, stamp],
    });
    await client.execute({
      sql: `INSERT INTO catches (
        id, photo_path, species, species_source, caught_at, time_of_day, season,
        habitat, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: ["mine-1", "uploads/john.jpg", "Redfish", "manual", stamp, "afternoon", "summer", "saltwater-inshore", stamp, stamp],
    });
    await migrateLibsql(client);
    const version = await client.execute({
      sql: "SELECT value FROM schema_meta WHERE key = ?",
      args: ["schema_version"],
    });
    const row = version.rows[0] as unknown as Record<string, unknown> | undefined;
    expect(String(row?.value ?? row?.[0] ?? "")).toBe("12");
    const leftover = await client.execute("SELECT id, photo_path FROM catches ORDER BY id");
    const ids = leftover.rows.map((r) => String((r as unknown as Record<string, unknown>).id ?? r[0]));
    expect(ids).toEqual(["mine-1"]);
    client.close();
  });
});
