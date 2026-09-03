import path from "node:path";
import { describe, expect, it } from "vitest";
import { databaseConfig, defaultSqlitePath } from "./config";

describe("databaseConfig", () => {
  it("defaults to the local SQLite file", () => {
    expect(databaseConfig({})).toEqual({
      mode: "file",
      filePath: defaultSqlitePath(),
      libsqlUrl: null,
      authToken: null,
    });
    expect(defaultSqlitePath()).toBe(path.join(process.cwd(), "data", "cast-log.sqlite"));
  });

  it("honors DATABASE_PATH for local journals", () => {
    expect(databaseConfig({ DATABASE_PATH: " /tmp/journal.sqlite " })).toMatchObject({
      mode: "file",
      filePath: "/tmp/journal.sqlite",
      libsqlUrl: null,
    });
  });

  it("switches to LibSQL when TURSO_DATABASE_URL is set", () => {
    expect(
      databaseConfig({
        DATABASE_PATH: "/tmp/local.sqlite",
        TURSO_DATABASE_URL: "libsql://catch-compass-john.turso.io",
        TURSO_AUTH_TOKEN: "tok_abc",
      }),
    ).toEqual({
      mode: "libsql",
      filePath: "/tmp/local.sqlite",
      libsqlUrl: "libsql://catch-compass-john.turso.io",
      authToken: "tok_abc",
    });
  });

  it("accepts DATABASE_URL as a Turso/LibSQL URL", () => {
    expect(
      databaseConfig({
        DATABASE_URL: "https://catch-compass-john.turso.io",
        TURSO_AUTH_TOKEN: "tok",
      }),
    ).toMatchObject({
      mode: "libsql",
      libsqlUrl: "https://catch-compass-john.turso.io",
      authToken: "tok",
    });
  });

  it("lets TURSO_DATABASE_URL win over a local DATABASE_PATH", () => {
    const cfg = databaseConfig({
      DATABASE_PATH: "./data/cast-log.sqlite",
      TURSO_DATABASE_URL: "libsql://prod.turso.io",
      DATABASE_URL: "postgres://ignored",
      TURSO_AUTH_TOKEN: "secret",
    });
    expect(cfg.mode).toBe("libsql");
    expect(cfg.libsqlUrl).toBe("libsql://prod.turso.io");
  });

  it("uses a file: TURSO URL for local LibSQL smoke tests", () => {
    expect(databaseConfig({ TURSO_DATABASE_URL: "file:/tmp/libsql.db" }).mode).toBe("libsql");
  });

  it("does not treat a postgres DATABASE_URL as LibSQL", () => {
    expect(databaseConfig({ DATABASE_URL: "postgres://localhost/catch" }).mode).toBe("file");
  });
});
