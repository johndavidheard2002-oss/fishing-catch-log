/** Await both better-sqlite3 (sync) and LibSQL (async) drizzle query endings. */

export async function allRows<T>(query: { all: () => T[] | Promise<T[]> }): Promise<T[]> {
  return await query.all();
}

export async function getRow<T>(query: {
  get: () => T | undefined | Promise<T | undefined>;
}): Promise<T | undefined> {
  return await query.get();
}

export async function runChange(query: {
  run: () =>
    | { changes?: number; rowsAffected?: number }
    | Promise<{ changes?: number; rowsAffected?: number }>;
}): Promise<number> {
  const result = await query.run();
  return Number(result.changes ?? result.rowsAffected ?? 0);
}
