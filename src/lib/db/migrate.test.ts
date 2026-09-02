import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { listCatches } from "./catches";
import { getDb, resetDbForTests } from "./index";

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

  it("adds habitat, moon, wind, and pressure on a pre-habitat sqlite file", () => {
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
    const records = listCatches();
    expect(records).toHaveLength(1);
    expect(records[0].habitat).toBe("saltwater-inshore");
    expect(records[0].moonPhase).toBeTruthy();
    expect(records[0].windDirection).toBeTruthy();
    expect(records[0].pressureInHg).toEqual(expect.any(Number));
    expect(records[0].speciesList).toEqual(["Redfish"]);
    expect(records[0].fishCount).toBe(1);
  });

  it("drops leftover sample trips so a real journal starts empty of demo fish", () => {
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
    const records = listCatches();
    expect(records).toHaveLength(1);
    expect(records[0].placeName).toBe("My lagoon");
    expect(records[0].photoPath).toBe("real-catch.jpg");
  });
});
