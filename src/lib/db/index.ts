import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { seedIfEmpty } from "./seed";
import * as schema from "./schema";

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS catches (
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
CREATE INDEX IF NOT EXISTS idx_catches_caught_at ON catches(caught_at);
CREATE INDEX IF NOT EXISTS idx_catches_species ON catches(species);
CREATE INDEX IF NOT EXISTS idx_catches_season ON catches(season);
CREATE INDEX IF NOT EXISTS idx_catches_time ON catches(time_of_day);
CREATE INDEX IF NOT EXISTS idx_catches_weather ON catches(weather_condition);
`;

type DbHandle = {
  sqlite: Database.Database;
  db: BetterSQLite3Database<typeof schema>;
};

declare global {
  var __castLogDb: DbHandle | undefined;
}

export function dataDir(): string {
  return path.join(process.cwd(), "data");
}

export function uploadsDir(): string {
  return path.join(process.cwd(), "data", "uploads");
}

function dbPath(): string {
  return process.env.DATABASE_PATH?.trim() || path.join(process.cwd(), "data", "cast-log.sqlite");
}

export function getDb() {
  if (globalThis.__castLogDb) return globalThis.__castLogDb.db;

  fs.mkdirSync(uploadsDir(), { recursive: true });
  const sqlite = new Database(dbPath());
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(CREATE_SQL);
  const db = drizzle(sqlite, { schema });
  globalThis.__castLogDb = { sqlite, db };
  seedIfEmpty(db);
  return db;
}

export function getSqlite(): Database.Database {
  getDb();
  return globalThis.__castLogDb!.sqlite;
}
