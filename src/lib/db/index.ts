import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { inferHabitat } from "../habitat";
import { moonForDate } from "../moon";
import { demoWeather } from "../weather/demo";
import { ensureDefaultAngler } from "./anglers";
import * as schema from "./schema";

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS catches (
  id TEXT PRIMARY KEY,
  photo_path TEXT,
  species TEXT NOT NULL,
  species_list TEXT,
  species_suggested TEXT,
  species_confidence REAL,
  species_source TEXT NOT NULL DEFAULT 'manual',
  latitude REAL,
  longitude REAL,
  photo_taken_latitude REAL,
  photo_taken_longitude REAL,
  place_name TEXT,
  temperature_f REAL,
  weather_condition TEXT,
  wind_speed_mph REAL,
  wind_direction TEXT,
  precipitation_in REAL,
  humidity INTEGER,
  moon_phase TEXT,
  moon_illumination REAL,
  pressure_in_hg REAL,
  pressure_mb REAL,
  pressure_trend TEXT,
  caught_at TEXT NOT NULL,
  time_of_day TEXT NOT NULL,
  season TEXT NOT NULL,
  notes TEXT,
  bait TEXT,
  tide TEXT,
  tide_height_ft REAL,
  tide_detail TEXT,
  water_clarity TEXT,
  habitat TEXT NOT NULL DEFAULT 'freshwater',
  fish_count INTEGER NOT NULL DEFAULT 1,
  species_counts TEXT,
  angler_id TEXT,
  shared_with_linked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_catches_caught_at ON catches(caught_at);
CREATE INDEX IF NOT EXISTS idx_catches_species ON catches(species);
CREATE INDEX IF NOT EXISTS idx_catches_season ON catches(season);
CREATE INDEX IF NOT EXISTS idx_catches_time ON catches(time_of_day);
CREATE INDEX IF NOT EXISTS idx_catches_weather ON catches(weather_condition);

CREATE TABLE IF NOT EXISTS anglers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS buddy_links (
  id TEXT PRIMARY KEY,
  angler_id TEXT NOT NULL,
  buddy_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (angler_id, buddy_id)
);

CREATE TABLE IF NOT EXISTS calendar_notes (
  id TEXT PRIMARY KEY,
  angler_id TEXT NOT NULL,
  day TEXT NOT NULL,
  title TEXT,
  notes TEXT,
  place_name TEXT,
  species_targets TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_calendar_notes_angler_day ON calendar_notes(angler_id, day);
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

function tableColumns(sqlite: Database.Database, table: string): string[] {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.map((r) => r.name);
}

function migrate(sqlite: Database.Database) {
  sqlite.exec(CREATE_SQL);
  const cols = tableColumns(sqlite, "catches");
  if (!cols.includes("habitat")) {
    sqlite.exec(`ALTER TABLE catches ADD COLUMN habitat TEXT NOT NULL DEFAULT 'freshwater'`);
  }
  if (!cols.includes("angler_id")) {
    sqlite.exec(`ALTER TABLE catches ADD COLUMN angler_id TEXT`);
  }
  if (!cols.includes("shared_with_linked")) {
    sqlite.exec(`ALTER TABLE catches ADD COLUMN shared_with_linked INTEGER NOT NULL DEFAULT 0`);
  }
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_catches_habitat ON catches(habitat)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_catches_angler ON catches(angler_id)`);

  const extra: [string, string][] = [
    ["wind_direction", "TEXT"],
    ["moon_phase", "TEXT"],
    ["moon_illumination", "REAL"],
    ["pressure_in_hg", "REAL"],
    ["pressure_mb", "REAL"],
    ["pressure_trend", "TEXT"],
    ["species_list", "TEXT"],
    ["photo_taken_latitude", "REAL"],
    ["photo_taken_longitude", "REAL"],
    ["fish_count", "INTEGER NOT NULL DEFAULT 1"],
    ["tide_height_ft", "REAL"],
    ["tide_detail", "TEXT"],
    ["species_counts", "TEXT"],
  ];
  const latestCols = tableColumns(sqlite, "catches");
  for (const [name, type] of extra) {
    if (!latestCols.includes(name)) {
      sqlite.exec(`ALTER TABLE catches ADD COLUMN ${name} ${type}`);
    }
  }

  const version = Number(sqlite.pragma("user_version", { simple: true }) ?? 0);
  if (version < 2) {
    const rows = sqlite.prepare("SELECT id, species FROM catches").all() as {
      id: string;
      species: string;
    }[];
    const update = sqlite.prepare("UPDATE catches SET habitat = ? WHERE id = ?");
    for (const row of rows) {
      update.run(inferHabitat(row.species), row.id);
    }
    sqlite.pragma("user_version = 2");
  }
  if (version < 3) {
    const rows = sqlite.prepare("SELECT id, caught_at, moon_phase FROM catches").all() as {
      id: string;
      caught_at: string;
      moon_phase: string | null;
    }[];
    const update = sqlite.prepare(
      "UPDATE catches SET moon_phase = ?, moon_illumination = ? WHERE id = ?",
    );
    for (const row of rows) {
      if (row.moon_phase) continue;
      const at = new Date(row.caught_at);
      if (Number.isNaN(at.getTime())) continue;
      const moon = moonForDate(at);
      update.run(moon.phase, moon.illumination, row.id);
    }
    sqlite.pragma("user_version = 3");
  }
  if (version < 4) {
    const rows = sqlite.prepare("SELECT id, species, species_list FROM catches").all() as {
      id: string;
      species: string;
      species_list: string | null;
    }[];
    const update = sqlite.prepare("UPDATE catches SET species_list = ? WHERE id = ?");
    for (const row of rows) {
      if (row.species_list) continue;
      update.run(JSON.stringify(row.species ? [row.species] : []), row.id);
    }
    sqlite.pragma("user_version = 4");
  }
  if (version < 5) {
    const rows = sqlite
      .prepare(
        `SELECT id, species, species_list, caught_at, latitude, longitude,
                moon_phase, moon_illumination, wind_direction,
                pressure_in_hg, pressure_mb, pressure_trend
         FROM catches`,
      )
      .all() as {
      id: string;
      species: string;
      species_list: string | null;
      caught_at: string;
      latitude: number | null;
      longitude: number | null;
      moon_phase: string | null;
      moon_illumination: number | null;
      wind_direction: string | null;
      pressure_in_hg: number | null;
      pressure_mb: number | null;
      pressure_trend: string | null;
    }[];
    const update = sqlite.prepare(
      `UPDATE catches SET
         species_list = ?,
         moon_phase = ?,
         moon_illumination = ?,
         wind_direction = ?,
         pressure_in_hg = ?,
         pressure_mb = ?,
         pressure_trend = ?
       WHERE id = ?`,
    );
    for (const row of rows) {
      const at = new Date(row.caught_at);
      const moon =
        row.moon_phase && row.moon_illumination != null
          ? { phase: row.moon_phase, illumination: row.moon_illumination }
          : Number.isNaN(at.getTime())
            ? null
            : moonForDate(at);
      let windDirection = row.wind_direction;
      let pressureInHg = row.pressure_in_hg;
      let pressureMb = row.pressure_mb;
      let pressureTrend = row.pressure_trend;
      if (
        row.latitude != null &&
        row.longitude != null &&
        !Number.isNaN(at.getTime()) &&
        (!windDirection || pressureInHg == null)
      ) {
        const demo = demoWeather(row.latitude, row.longitude, at);
        windDirection = windDirection || demo.windDirection;
        if (pressureInHg == null) {
          pressureInHg = demo.pressureInHg;
          pressureMb = pressureMb ?? demo.pressureMb ?? null;
          pressureTrend = pressureTrend || demo.pressureTrend;
        }
      }
      update.run(
        row.species_list || JSON.stringify(row.species ? [row.species] : []),
        moon?.phase ?? row.moon_phase,
        moon?.illumination ?? row.moon_illumination,
        windDirection,
        pressureInHg,
        pressureMb,
        pressureTrend,
        row.id,
      );
    }
    sqlite.pragma("user_version = 5");
  }
  if (version < 6) {
    const rows = sqlite.prepare("SELECT id, species, species_list, fish_count FROM catches").all() as {
      id: string;
      species: string;
      species_list: string | null;
      fish_count: number | null;
    }[];
    const update = sqlite.prepare("UPDATE catches SET fish_count = ? WHERE id = ?");
    for (const row of rows) {
      let speciesCount = 1;
      try {
        const parsed = row.species_list ? (JSON.parse(row.species_list) as unknown) : null;
        if (Array.isArray(parsed) && parsed.length) speciesCount = parsed.length;
        else if (row.species) speciesCount = 1;
      } catch {
        speciesCount = row.species ? 1 : 1;
      }
      const next = Math.max(row.fish_count && row.fish_count > 0 ? row.fish_count : 1, speciesCount);
      update.run(next, row.id);
    }
    sqlite.pragma("user_version = 6");
  }
  if (version < 7) {
    sqlite.exec(`
      DELETE FROM catches
      WHERE photo_path LIKE '/seed/%'
         OR (species_source = 'demo' AND (photo_path IS NULL OR photo_path = ''))
    `);
    sqlite.pragma("user_version = 7");
  }
  if (version < 8) {
    sqlite.pragma("user_version = 8");
  }
  if (version < 9) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS calendar_notes (
        id TEXT PRIMARY KEY,
        angler_id TEXT NOT NULL,
        day TEXT NOT NULL,
        title TEXT,
        notes TEXT,
        place_name TEXT,
        species_targets TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_calendar_notes_angler_day ON calendar_notes(angler_id, day);
    `);
    sqlite.pragma("user_version = 9");
  }
}

export function getDb() {
  if (globalThis.__castLogDb) return globalThis.__castLogDb.db;

  fs.mkdirSync(uploadsDir(), { recursive: true });
  const sqlite = new Database(dbPath());
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  migrate(sqlite);
  const db = drizzle(sqlite, { schema });
  globalThis.__castLogDb = { sqlite, db };
  const owner = ensureDefaultAngler();
  sqlite
    .prepare("UPDATE catches SET angler_id = ? WHERE angler_id IS NULL OR angler_id = ''")
    .run(owner.id);
  return db;
}

export function getSqlite(): Database.Database {
  getDb();
  return globalThis.__castLogDb!.sqlite;
}

export function resetDbForTests() {
  if (!globalThis.__castLogDb) return;
  globalThis.__castLogDb.sqlite.close();
  globalThis.__castLogDb = undefined;
}
