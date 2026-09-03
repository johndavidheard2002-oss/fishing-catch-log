import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { listCatches } from "./catches";
import { getDb, getSqlite, resetDbForTests, SCHEMA_VERSION } from "./index";

const OLD_CREATE = `
CREATE TABLE catches (
  id TEXT PRIMARY KEY,
  photo_path TEXT,
  species TEXT NOT NULL,
  species_suggested TEXT,
  species_confidence REAL,
  species_source TEXT NOT NULL DEFAULT 'manual',
  latitude REAL,
  longitude REAL,
  place_name TEXT,
  temperature_f REAL,
  weather_condition TEXT,
  wind_speed_mph REAL,
  precipitation_in REAL,
  humidity INTEGER,
  caught_at TEXT NOT NULL,
  time_of_day TEXT NOT NULL,
  season TEXT NOT NULL,
  notes TEXT,
  bait TEXT,
  tide TEXT,
  water_clarity TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

describe("migrate older journals", () => {
  const previousPath = process.env.DATABASE_PATH;
  const tmpDirs: string[] = [];

  afterEach(() => {
    resetDbForTests();
    if (previousPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previousPath;
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  it("adds habitat, moon, wind, and pressure on a pre-habitat sqlite file", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-"));
    tmpDirs.push(dir);
    const file = path.join(dir, "old.sqlite");
    const sqlite = new Database(file);
    sqlite.exec(OLD_CREATE);
    sqlite
      .prepare(
        `INSERT INTO catches (
          id, species, latitude, longitude, place_name, temperature_f,
          weather_condition, wind_speed_mph, precipitation_in, humidity,
          caught_at, time_of_day, season, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "old-1",
        "Redfish",
        28.74,
        -80.75,
        "Mosquito Lagoon, FL",
        84,
        "clear",
        9,
        0,
        70,
        "2025-06-02T11:10:00.000Z",
        "morning",
        "summer",
        "2025-06-02T12:00:00.000Z",
        "2025-06-02T12:00:00.000Z",
      );
    sqlite.close();

    process.env.DATABASE_PATH = file;
    resetDbForTests();
    getDb();
    const records = await listCatches();
    expect(records).toHaveLength(1);
    expect(records[0].habitat).toBe("saltwater-inshore");
    expect(records[0].moonPhase).toBeTruthy();
    expect(records[0].windDirection).toBeTruthy();
    expect(records[0].pressureInHg).toEqual(expect.any(Number));
    expect(records[0].speciesList).toEqual(["Redfish"]);
    expect(records[0].fishCount).toBe(1);
    expect(records[0].speciesCounts).toEqual([{ species: "Redfish", count: 1 }]);
    expect(records[0].tideHeightFt).toBeNull();
    expect(records[0].tideDetail).toBeNull();
  });

  it("drops leftover sample trips so a real journal starts empty of demo fish", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-"));
    tmpDirs.push(dir);
    const file = path.join(dir, "old.sqlite");
    const sqlite = new Database(file);
    sqlite.exec(OLD_CREATE);
    sqlite.exec(`ALTER TABLE catches ADD COLUMN habitat TEXT NOT NULL DEFAULT 'freshwater'`);
    const insert = sqlite.prepare(
      `INSERT INTO catches (
        id, photo_path, species, latitude, longitude, place_name,
        caught_at, time_of_day, season, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    insert.run(
      "seed-1",
      "/seed/largemouth.svg",
      "Largemouth Bass",
      30.388,
      -97.975,
      "Lake Travis, TX",
      "2025-07-12T20:40:00.000Z",
      "afternoon",
      "summer",
      "2025-07-12T20:40:00.000Z",
      "2025-07-12T20:40:00.000Z",
    );
    insert.run(
      "mine-1",
      "real-catch.jpg",
      "Redfish",
      28.74,
      -80.75,
      "My lagoon",
      "2026-08-02T15:00:00.000Z",
      "afternoon",
      "summer",
      "2026-08-02T15:00:00.000Z",
      "2026-08-02T15:00:00.000Z",
    );
    sqlite.exec(`UPDATE catches SET species_source = 'manual' WHERE id = 'mine-1'`);
    insert.run(
      "ghost-demo",
      null,
      "Largemouth Bass",
      30.458,
      -98.012,
      "Pace Bend, Lake Travis, TX",
      "2025-07-12T12:15:00.000Z",
      "dawn",
      "summer",
      "2026-09-02T02:49:18.000Z",
      "2026-09-02T02:49:18.000Z",
    );
    sqlite.exec(`UPDATE catches SET species_source = 'demo' WHERE id = 'ghost-demo'`);
    sqlite.close();

    process.env.DATABASE_PATH = file;
    resetDbForTests();
    getDb();
    const records = await listCatches();
    expect(records).toHaveLength(1);
    expect(records[0].placeName).toBe("My lagoon");
    expect(records[0].photoPath).toBe("real-catch.jpg");
  });

  it("adds email and password hash on a pre-auth anglers table and keeps rows", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-"));
    tmpDirs.push(dir);
    const file = path.join(dir, "old-anglers.sqlite");
    const sqlite = new Database(file);
    sqlite.exec(`
      CREATE TABLE anglers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        invite_code TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );
    `);
    sqlite
      .prepare("INSERT INTO anglers (id, name, invite_code, created_at) VALUES (?, ?, ?, ?)")
      .run("angler-1", "Pat", "CAST-OLD1", "2026-08-01T12:00:00.000Z");
    sqlite.close();

    process.env.DATABASE_PATH = file;
    resetDbForTests();
    getDb();
    const cols = getSqlite()
      .prepare(`PRAGMA table_info(anglers)`)
      .all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("email");
    expect(names).toContain("password_hash");
    const row = getSqlite()
      .prepare("SELECT id, name, email, password_hash FROM anglers WHERE id = ?")
      .get("angler-1") as { id: string; name: string; email: string | null; password_hash: string | null };
    expect(row.name).toBe("Pat");
    expect(row.email).toBeNull();
    expect(row.password_hash).toBeNull();
    const indexes = getSqlite()
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_anglers_email'`)
      .all();
    expect(indexes).toHaveLength(1);
    expect(Number(getSqlite().pragma("user_version", { simple: true }))).toBe(SCHEMA_VERSION);
  });

  it("adds email and password hash columns on anglers", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-"));
    tmpDirs.push(dir);
    process.env.DATABASE_PATH = path.join(dir, "journal.sqlite");
    resetDbForTests();
    getDb();
    const cols = getSqlite()
      .prepare(`PRAGMA table_info(anglers)`)
      .all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("email");
    expect(names).toContain("password_hash");
    expect(Number(getSqlite().pragma("user_version", { simple: true }))).toBe(SCHEMA_VERSION);
  });

  it("creates the calendar_notes table for planned trips", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-"));
    tmpDirs.push(dir);
    process.env.DATABASE_PATH = path.join(dir, "journal.sqlite");
    resetDbForTests();
    getDb();
    const tables = getSqlite()
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("calendar_notes");
    expect(names).toContain("named_areas");
    expect(names).toContain("bait_spots");
  });

  it("adds named_areas and bait_spots when opening an older journal again", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-"));
    tmpDirs.push(dir);
    const file = path.join(dir, "journal.sqlite");
    process.env.DATABASE_PATH = file;
    resetDbForTests();
    getDb();
    getSqlite().pragma("user_version = 9");
    getSqlite().exec("DROP TABLE IF EXISTS named_areas");
    getSqlite().exec("DROP TABLE IF EXISTS bait_spots");
    getDb();
    const tables = getSqlite()
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("named_areas");
    expect(names).toContain("bait_spots");
  });

  it("purges reloaded sample trips on a v11 journal and keeps real uploads", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-"));
    tmpDirs.push(dir);
    const file = path.join(dir, "journal.sqlite");
    process.env.DATABASE_PATH = file;
    resetDbForTests();
    getDb();
    const sqlite = getSqlite();
    expect(Number(sqlite.pragma("user_version", { simple: true }))).toBe(SCHEMA_VERSION);
    sqlite.pragma("user_version = 11");
    const stamp = "2026-09-03T12:00:00.000Z";
    const insert = sqlite.prepare(
      `INSERT INTO catches (
        id, photo_path, species, species_source, caught_at, time_of_day, season,
        habitat, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    insert.run(
      "seed-1",
      "/seed/striper.svg",
      "Striped Bass",
      "demo",
      stamp,
      "afternoon",
      "summer",
      "freshwater",
      stamp,
      stamp,
    );
    insert.run(
      "mine-1",
      "uploads/john-redfish.jpg",
      "Redfish",
      "manual",
      stamp,
      "afternoon",
      "summer",
      "saltwater-inshore",
      stamp,
      stamp,
    );
    insert.run(
      "vision-demo",
      "uploads/john-trout.jpg",
      "Speckled Trout",
      "demo",
      stamp,
      "morning",
      "summer",
      "saltwater-inshore",
      stamp,
      stamp,
    );
    sqlite
      .prepare(
        `INSERT INTO bait_spots (
          id, photo_path, bait_types, logged_at, time_of_day, season, habitat,
          angler_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "seed-bait",
        "/seed/redfish.svg",
        "[]",
        stamp,
        "morning",
        "summer",
        "saltwater-inshore",
        "a1",
        stamp,
        stamp,
      );
    resetDbForTests();
    getDb();
    expect(Number(getSqlite().pragma("user_version", { simple: true }))).toBe(SCHEMA_VERSION);
    const records = await listCatches();
    expect(records.map((r) => r.id).sort()).toEqual(["mine-1", "vision-demo"]);
    expect(records.some((r) => r.photoPath?.startsWith("/seed/"))).toBe(false);
    const bait = getSqlite().prepare("SELECT id FROM bait_spots").all() as { id: string }[];
    expect(bait).toEqual([]);
  });
});
