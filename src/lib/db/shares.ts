import { and, eq, inArray } from "drizzle-orm";
import { ensureDb } from "./index";
import { allRows, runChange } from "./query";
import { spotShares } from "./schema";

export type SpotShareKind = "catch" | "bait";

export async function sharesByRecord(
  kind: SpotShareKind,
  recordIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  const unique = [...new Set(recordIds.filter(Boolean))];
  if (!unique.length) return map;
  const db = await ensureDb();
  const rows = await allRows(
    db
      .select()
      .from(spotShares)
      .where(and(eq(spotShares.kind, kind), inArray(spotShares.recordId, unique))),
  );
  for (const row of rows) {
    const list = map.get(row.recordId) ?? [];
    list.push(row.buddyId);
    map.set(row.recordId, list);
  }
  return map;
}

export async function recordIdsSharedWith(
  kind: SpotShareKind,
  viewerId: string,
): Promise<Set<string>> {
  const db = await ensureDb();
  const rows = await allRows(
    db
      .select()
      .from(spotShares)
      .where(and(eq(spotShares.kind, kind), eq(spotShares.buddyId, viewerId))),
  );
  return new Set(rows.map((row) => row.recordId));
}

export async function setRecordShares(args: {
  kind: SpotShareKind;
  recordId: string;
  ownerId: string;
  buddyIds: string[];
}): Promise<string[]> {
  const unique = [...new Set(args.buddyIds.filter((id) => id && id !== args.ownerId))];
  const db = await ensureDb();
  await runChange(
    db
      .delete(spotShares)
      .where(and(eq(spotShares.kind, args.kind), eq(spotShares.recordId, args.recordId))),
  );
  const stamp = new Date().toISOString();
  for (const buddyId of unique) {
    await runChange(
      db.insert(spotShares).values({
        id: crypto.randomUUID(),
        ownerId: args.ownerId,
        kind: args.kind,
        recordId: args.recordId,
        buddyId,
        createdAt: stamp,
      }),
    );
  }
  return unique;
}

export async function clearRecordShares(kind: SpotShareKind, recordId: string): Promise<void> {
  const db = await ensureDb();
  await runChange(
    db.delete(spotShares).where(and(eq(spotShares.kind, kind), eq(spotShares.recordId, recordId))),
  );
}
