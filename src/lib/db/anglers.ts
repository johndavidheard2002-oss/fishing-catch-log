import { and, eq } from "drizzle-orm";
import { getDb, getSqlite } from "./index";
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

export function ensureDefaultAngler(): AnglerRecord {
  const sqlite = getSqlite();
  const existing = sqlite
    .prepare("SELECT id, name, invite_code, created_at FROM anglers ORDER BY created_at ASC LIMIT 1")
    .get() as
    | { id: string; name: string; invite_code: string; created_at: string }
    | undefined;
  if (existing) {
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
  return row;
}

export function getAngler(id: string): AnglerRecord | null {
  const db = getDb();
  const row = db.select().from(anglers).where(eq(anglers.id, id)).get();
  return row ? mapAngler(row) : null;
}

export function getAnglerByCode(code: string): AnglerRecord | null {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const db = getDb();
  const row = db.select().from(anglers).where(eq(anglers.inviteCode, normalized)).get();
  return row ? mapAngler(row) : null;
}

export function listAnglers(): AnglerRecord[] {
  const db = getDb();
  return db.select().from(anglers).all().map(mapAngler);
}

export function createAngler(name: string): AnglerRecord {
  const db = getDb();
  const id = crypto.randomUUID();
  const stamp = new Date().toISOString();
  const inviteCode = newInviteCode();
  db.insert(anglers)
    .values({
      id,
      name: name.trim() || "Buddy",
      inviteCode,
      createdAt: stamp,
    })
    .run();
  return getAngler(id)!;
}

export function renameAngler(id: string, name: string): AnglerRecord | null {
  const existing = getAngler(id);
  if (!existing) return null;
  const db = getDb();
  db.update(anglers)
    .set({ name: name.trim() || existing.name })
    .where(eq(anglers.id, id))
    .run();
  return getAngler(id);
}

export function linkedBuddyIds(anglerId: string): string[] {
  const db = getDb();
  return db
    .select()
    .from(buddyLinks)
    .where(eq(buddyLinks.anglerId, anglerId))
    .all()
    .map((row) => row.buddyId);
}

export function listBuddies(anglerId: string): BuddyRecord[] {
  const ids = linkedBuddyIds(anglerId);
  const db = getDb();
  return ids
    .map((id) => {
      const angler = getAngler(id);
      if (!angler) return null;
      const link = db
        .select()
        .from(buddyLinks)
        .where(and(eq(buddyLinks.anglerId, anglerId), eq(buddyLinks.buddyId, id)))
        .get();
      return { ...angler, linkedAt: link?.createdAt ?? angler.createdAt };
    })
    .filter((b): b is BuddyRecord => b != null);
}

function insertLink(fromId: string, toId: string) {
  const db = getDb();
  const existing = db
    .select()
    .from(buddyLinks)
    .where(and(eq(buddyLinks.anglerId, fromId), eq(buddyLinks.buddyId, toId)))
    .get();
  if (existing) return;
  db.insert(buddyLinks)
    .values({
      id: crypto.randomUUID(),
      anglerId: fromId,
      buddyId: toId,
      createdAt: new Date().toISOString(),
    })
    .run();
}

export function linkAnglers(a: string, b: string): void {
  if (a === b) throw new Error("You cannot link to yourself.");
  insertLink(a, b);
  insertLink(b, a);
}

export function unlinkAnglers(a: string, b: string): void {
  const db = getDb();
  db.delete(buddyLinks)
    .where(and(eq(buddyLinks.anglerId, a), eq(buddyLinks.buddyId, b)))
    .run();
  db.delete(buddyLinks)
    .where(and(eq(buddyLinks.anglerId, b), eq(buddyLinks.buddyId, a)))
    .run();
}

export function areLinked(a: string, b: string): boolean {
  return linkedBuddyIds(a).includes(b);
}
