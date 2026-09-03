import path from "node:path";

export type DatabaseMode = "file" | "libsql";

export type DatabaseConfig = {
  mode: DatabaseMode;
  /** Local SQLite file used in file mode (and as the default path in docs). */
  filePath: string;
  /** Turso / LibSQL URL when mode is libsql. */
  libsqlUrl: string | null;
  authToken: string | null;
};

const DEFAULT_FILE = path.join(process.cwd(), "data", "cast-log.sqlite");

function trim(value: string | undefined): string {
  return value?.trim() ?? "";
}

function isRemoteLibsqlUrl(url: string): boolean {
  return (
    url.startsWith("libsql://") ||
    url.startsWith("https://") ||
    url.startsWith("wss://") ||
    url.startsWith("http://") ||
    url.startsWith("ws://")
  );
}

/** file: URLs are for local LibSQL smoke tests, not production Turso. */
function isLibsqlFileUrl(url: string): boolean {
  return url.startsWith("file:") || url === ":memory:";
}

/**
 * File SQLite is the default (local demo).
 * TURSO_DATABASE_URL or a LibSQL DATABASE_URL switches to remote (Turso wins if both are set).
 */
export function databaseConfig(env: Record<string, string | undefined> = process.env): DatabaseConfig {
  const filePath = trim(env.DATABASE_PATH) || DEFAULT_FILE;
  const turso = trim(env.TURSO_DATABASE_URL);
  const databaseUrl = trim(env.DATABASE_URL);
  const token = trim(env.TURSO_AUTH_TOKEN) || trim(env.LIBSQL_AUTH_TOKEN) || null;

  if (turso && (isRemoteLibsqlUrl(turso) || isLibsqlFileUrl(turso))) {
    return { mode: "libsql", filePath, libsqlUrl: turso, authToken: token };
  }
  if (databaseUrl && isRemoteLibsqlUrl(databaseUrl)) {
    return { mode: "libsql", filePath, libsqlUrl: databaseUrl, authToken: token };
  }
  return { mode: "file", filePath, libsqlUrl: null, authToken: null };
}

export function defaultSqlitePath(): string {
  return DEFAULT_FILE;
}
