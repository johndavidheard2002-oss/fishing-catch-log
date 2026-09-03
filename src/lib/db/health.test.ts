import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { databaseConfig } from "./config";
import { healthSnapshot, probeJournalHealth, redactDbError } from "./health";
import { resetDbForTests } from "./index";

describe("healthSnapshot", () => {
  it("reports booleans only and never includes url or token", () => {
    const config = databaseConfig({
      TURSO_DATABASE_URL: "libsql://catch-compass-john.turso.io",
      TURSO_AUTH_TOKEN: "tok_super_secret",
    });
    const health = healthSnapshot({
      config,
      uploadsDirConfigured: true,
      dbError: null,
    });
    expect(health).toEqual({
      ok: true,
      databaseMode: "libsql",
      hasTursoUrl: true,
      hasTursoToken: true,
      uploadsDirConfigured: true,
      dbError: null,
    });
    const raw = JSON.stringify(health);
    expect(raw).not.toContain("libsql://");
    expect(raw).not.toContain("tok_super_secret");
    expect(raw).not.toContain("catch-compass-john");
  });
});

describe("redactDbError", () => {
  it("strips the configured url/token and truncates", () => {
    const config = databaseConfig({
      TURSO_DATABASE_URL: "libsql://prod.turso.io",
      TURSO_AUTH_TOKEN: "tok_live",
    });
    const redacted = redactDbError(
      new Error(`connect libsql://prod.turso.io failed token=tok_live ${"x".repeat(600)}`),
      config,
    );
    expect(redacted).not.toContain("prod.turso.io");
    expect(redacted).not.toContain("tok_live");
    expect(redacted).toContain("[url]");
    expect(redacted).toContain("[token]");
    expect(redacted.length).toBeLessThanOrEqual(500);
  });
});

describe("probeJournalHealth", () => {
  const previous = {
    DATABASE_PATH: process.env.DATABASE_PATH,
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
    UPLOADS_DIR: process.env.UPLOADS_DIR,
  };
  const tmpDirs: string[] = [];

  afterEach(() => {
    resetDbForTests();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  it("opens a local file journal and stays secret-free", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-health-"));
    tmpDirs.push(dir);
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
    delete process.env.UPLOADS_DIR;
    process.env.DATABASE_PATH = path.join(dir, "journal.sqlite");
    resetDbForTests();
    const health = await probeJournalHealth();
    expect(health.ok).toBe(true);
    expect(health.databaseMode).toBe("file");
    expect(health.hasTursoUrl).toBe(false);
    expect(health.hasTursoToken).toBe(false);
    expect(health.uploadsDirConfigured).toBe(false);
    expect(health.dbError).toBeNull();
    expect(JSON.stringify(health)).not.toMatch(/libsql:\/\//);
  });
});
