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
  });
});
