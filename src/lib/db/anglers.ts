import { and, asc, eq } from "drizzle-orm";
import type Database from "better-sqlite3";
import { databaseConfig } from "./config";
import { ensureDb, getDb, getSqlite, type JournalDatabase } from "./index";
import { allRows, getRow, runChange } from "./query";
import { anglers, buddyLinks } from "./schema";

export type AnglerRecord = {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
};

export type BuddyRecord = AnglerRecord & { linkedAt: string };

function mapAngler(row: typeof anglers.$inferSelect): AnglerRecord {
  return {
    id: row.id,
    name: row.name,
    inviteCode: row.inviteCode,
    createdAt: row.createdAt,
  };
}

function newInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `CAST-${code}`;
}

export function seedDefaultAnglerOnSqlite(sqlite: Database.Database): AnglerRecord {
  const existing = sqlite
    .prepare("SELECT id, name, invite_code, created_at FROM anglers ORDER BY created_at ASC LIMIT 1")
    .get() as
    | { id: string; name: string; invite_code: string; created_at: string }
    | undefined;
  if (existing) {
    sqlite
      .prepare("UPDATE catches SET angler_id = ? WHERE angler_id IS NULL OR angler_id = ''")
      .run(existing.id);
    return {
      id: existing.id,
      name: existing.name,
      inviteCode: existing.invite_code,
      createdAt: existing.created_at,
    };
  }
  const row = {
    id: crypto.randomUUID(),
    name: "You",
    inviteCode: newInviteCode(),
    createdAt: new Date().toISOString(),
  };
  sqlite
    .prepare("INSERT INTO anglers (id, name, invite_code, created_at) VALUES (?, ?, ?, ?)")
    .run(row.id, row.name, row.inviteCode, row.createdAt);
  sqlite
    .prepare("UPDATE catches SET angler_id = ? WHERE angler_id IS NULL OR angler_id = ''")
    .run(row.id);
  return row;
}

export function ensureDefaultAngler(): AnglerRecord {
  if (databaseConfig().mode === "libsql") {
    throw new Error("ensureDefaultAngler() is sync file-SQLite only; await seedDefaultAngler() for Turso");
  }
  getDb();
  return seedDefaultAnglerOnSqlite(getSqlite());
}

/** Does not call ensureDb — used while the LibSQL migrate promise is still running. */
export async function upsertDefaultAngler(db: JournalDatabase): Promise<AnglerRecord> {
  const existing = await allRows(db.select().from(anglers).orderBy(asc(anglers.createdAt)).limit(1));
  if (existing[0]) return mapAngler(existing[0]);
  const row = {
    id: crypto.randomUUID(),
    name: "You",
    inviteCode: newInviteCode(),
    createdAt: new Date().toISOString(),
  };
  await runChange(
    db.insert(anglers).values({
      id: row.id,
      name: row.name,
      inviteCode: row.inviteCode,
      createdAt: row.createdAt,
    }),
  );
  return row;
}

/** Boot/migrate only: ensure at least one angler row exists. Never use this as a new visitor’s identity. */
export async function seedDefaultAngler(): Promise<AnglerRecord> {
  if (databaseConfig().mode === "file") return ensureDefaultAngler();
  const db = await ensureDb();
  return upsertDefaultAngler(db);
}

export async function getAngler(id: string): Promise<AnglerRecord | null> {
  const db = await ensureDb();
  const row = await getRow(db.select().from(anglers).where(eq(anglers.id, id)));
  return row ? mapAngler(row) : null;
}

export async function getAnglerByCode(code: string): Promise<AnglerRecord | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const db = await ensureDb();
  const row = await getRow(db.select().from(anglers).where(eq(anglers.inviteCode, normalized)));
  return row ? mapAngler(row) : null;
}

export async function listAnglers(): Promise<AnglerRecord[]> {
  const db = await ensureDb();
  const rows = await allRows(db.select().from(anglers));
  return rows.map(mapAngler);
}

/** This browser’s journal plus friends linked on this phone — not every angler in the database. */
export async function listHouseholdProfiles(viewerId: string): Promise<AnglerRecord[]> {
  const me = await getAngler(viewerId);
  const linked = await listBuddies(viewerId);
  const seen = new Set<string>();
  const out: AnglerRecord[] = [];
  for (const row of [me, ...linked]) {
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

export async function createAngler(name: string, id?: string): Promise<AnglerRecord> {
  const anglerId = id?.trim() || crypto.randomUUID();
  const existing = await getAngler(anglerId);
  if (existing) return existing;
  const db = await ensureDb();
  const stamp = new Date().toISOString();
  const inviteCode = newInviteCode();
  try {
    await runChange(
      db.insert(anglers).values({
        id: anglerId,
        name: name.trim() || "Friend",
        inviteCode,
        createdAt: stamp,
      }),
    );
  } catch {
    const raced = await getAngler(anglerId);
    if (raced) return raced;
    throw new Error("Could not create journal");
  }
  return (await getAngler(anglerId))!;
}

export async function renameAngler(id: string, name: string): Promise<AnglerRecord | null> {
  const existing = await getAngler(id);
  if (!existing) return null;
  const db = await ensureDb();
  await runChange(
    db.update(anglers)
      .set({ name: name.trim() || existing.name })
      .where(eq(anglers.id, id)),
  );
  return getAngler(id);
}

export async function linkedBuddyIds(anglerId: string): Promise<string[]> {
  const db = await ensureDb();
  const rows = await allRows(db.select().from(buddyLinks).where(eq(buddyLinks.anglerId, anglerId)));
  return rows.map((row) => row.buddyId);
}

export async function listBuddies(anglerId: string): Promise<BuddyRecord[]> {
  const ids = await linkedBuddyIds(anglerId);
  const db = await ensureDb();
  const out: BuddyRecord[] = [];
  for (const id of ids) {
    const angler = await getAngler(id);
    if (!angler) continue;
    const link = await getRow(
      db
        .select()
        .from(buddyLinks)
        .where(and(eq(buddyLinks.anglerId, anglerId), eq(buddyLinks.buddyId, id))),
    );
    out.push({ ...angler, linkedAt: link?.createdAt ?? angler.createdAt });
  }
  return out;
}

async function insertLink(fromId: string, toId: string) {
  const db = await ensureDb();
  const existing = await getRow(
    db
      .select()
      .from(buddyLinks)
      .where(and(eq(buddyLinks.anglerId, fromId), eq(buddyLinks.buddyId, toId))),
  );
  if (existing) return;
  await runChange(
    db.insert(buddyLinks).values({
      id: crypto.randomUUID(),
      anglerId: fromId,
      buddyId: toId,
      createdAt: new Date().toISOString(),
    }),
  );
}

export async function linkAnglers(a: string, b: string): Promise<void> {
  if (a === b) throw new Error("You cannot link to yourself.");
  await insertLink(a, b);
  await insertLink(b, a);
}

export async function unlinkAnglers(a: string, b: string): Promise<void> {
  const db = await ensureDb();
  await runChange(
    db.delete(buddyLinks).where(and(eq(buddyLinks.anglerId, a), eq(buddyLinks.buddyId, b))),
  );
  await runChange(
    db.delete(buddyLinks).where(and(eq(buddyLinks.anglerId, b), eq(buddyLinks.buddyId, a))),
  );
}

export async function areLinked(a: string, b: string): Promise<boolean> {
  return (await linkedBuddyIds(a)).includes(b);
}
