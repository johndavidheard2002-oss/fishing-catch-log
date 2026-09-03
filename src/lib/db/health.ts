import { databaseConfig, type DatabaseConfig, type DatabaseMode } from "./config";
import { ensureDb } from "./index";

export type JournalHealth = {
  ok: boolean;
  databaseMode: DatabaseMode;
  hasTursoUrl: boolean;
  hasTursoToken: boolean;
  uploadsDirConfigured: boolean;
  dbError: string | null;
};

const ERROR_MAX = 500;

export function healthSnapshot(args: {
  config: DatabaseConfig;
  uploadsDirConfigured: boolean;
  dbError: string | null;
}): JournalHealth {
  return {
    ok: args.dbError == null,
    databaseMode: args.config.mode,
    hasTursoUrl: Boolean(args.config.libsqlUrl),
    hasTursoToken: Boolean(args.config.authToken),
    uploadsDirConfigured: args.uploadsDirConfigured,
    dbError: args.dbError,
  };
}

/** Strip URL/token values from a driver error so /api/health never echoes secrets. */
export function redactDbError(err: unknown, config: DatabaseConfig): string {
  let message = err instanceof Error ? err.message : String(err);
  if (config.libsqlUrl) message = message.split(config.libsqlUrl).join("[url]");
  if (config.authToken) message = message.split(config.authToken).join("[token]");
  message = message
    .replace(/libsql:\/\/\S+/gi, "[url]")
    .replace(/wss?:\/\/\S+/gi, "[url]")
    .replace(/https?:\/\/\S+/gi, "[url]");
  return message.slice(0, ERROR_MAX);
}

export async function probeJournalHealth(
  env: Record<string, string | undefined> = process.env,
): Promise<JournalHealth> {
  const config = databaseConfig(env);
  const uploadsDirConfigured = Boolean(env.UPLOADS_DIR?.trim());
  try {
    await ensureDb();
    return healthSnapshot({ config, uploadsDirConfigured, dbError: null });
  } catch (err) {
    return healthSnapshot({
      config,
      uploadsDirConfigured,
      dbError: redactDbError(err, config),
    });
  }
}
