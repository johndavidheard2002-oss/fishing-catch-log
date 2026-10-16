import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AUTH_WRONG, loginJournal, registerJournal, signSession } from "./auth";
import { allRows } from "./db/query";
import { getDb, resetDbForTests } from "./db/index";
import { passwordResets } from "./db/schema";
import { deleteAnglerAccount } from "./db/delete-account";
import type { OutgoingEmail, SendEmailResult } from "./email";
import {
  FORGOT_GENERIC_MESSAGE,
  FORGOT_RATE_LIMITED,
  PRODUCTION_APP_URL,
  RESET_LINK_INVALID,
  RESET_TOKEN_TTL_MS,
  hashResetToken,
  requestPasswordReset,
  resetEmail,
  resetLinkOrigin,
  resetPasswordResetLimitsForTests,
  resetPasswordWithToken,
  resetTokenUsable,
} from "./password-reset";
import { SESSION_COOKIE, requireViewerId } from "./viewer";

describe("password reset", () => {
  const previousPath = process.env.DATABASE_PATH;
  const tmpDirs: string[] = [];
  let sent: OutgoingEmail[] = [];
  const sender = async (message: OutgoingEmail): Promise<SendEmailResult> => {
    sent.push(message);
    return { ok: true, id: "test" };
  };

  beforeEach(() => {
    sent = [];
    resetPasswordResetLimitsForTests();
  });

  afterEach(() => {
    resetDbForTests();
    if (previousPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previousPath;
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  function freshJournal() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-reset-"));
    tmpDirs.push(dir);
    process.env.DATABASE_PATH = path.join(dir, "journal.sqlite");
    resetDbForTests();
    getDb();
  }

  async function registered(email = "angler@example.com", password = "old-password") {
    const res = await registerJournal({ name: "Angler", email, password, confirm: password });
    if (!res.ok) throw new Error(res.error);
    return res.angler;
  }

  function tokenFrom(message: OutgoingEmail): string {
    const match = message.text.match(/reset-password\?token=([A-Za-z0-9_-]+)/);
    if (!match) throw new Error("no link in email");
    return decodeURIComponent(match[1]!);
  }

  async function forgot(email: string, ip = "1.1.1.1") {
    const result = await requestPasswordReset({ email, ip, origin: "https://app.test", sender });
    if (result.ok) await result.send;
    return result;
  }

  function requestWithSession(token: string) {
    const headers = new Headers();
    headers.set("cookie", `${SESSION_COOKIE}=${token}`);
    return new NextRequest("http://localhost/api/me", { headers });
  }

  it("answers the same for known and unknown emails and only mails real accounts", async () => {
    freshJournal();
    await registered();
    const known = await forgot("Angler@Example.com ");
    const unknown = await forgot("nobody@example.com");
    const junk = await forgot("not-an-email");
    expect(known).toMatchObject({ ok: true, message: FORGOT_GENERIC_MESSAGE });
    expect(unknown).toMatchObject({ ok: true, message: FORGOT_GENERIC_MESSAGE });
    expect(junk).toMatchObject({ ok: true, message: FORGOT_GENERIC_MESSAGE });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("angler@example.com");
    expect(sent[0]!.text).toContain("https://app.test/reset-password?token=");
    expect(sent[0]!.subject).toBe("Reset your Tide Mark password");
  });

  it("stores only a hash of the token, with a one hour expiry", async () => {
    freshJournal();
    const angler = await registered();
    const now = Date.parse("2026-10-16T12:00:00.000Z");
    const result = await requestPasswordReset({
      email: "angler@example.com",
      ip: "1.1.1.1",
      origin: "https://app.test",
      sender,
      now,
    });
    if (result.ok) await result.send;
    const token = tokenFrom(sent[0]!);
    const rows = await allRows(getDb().select().from(passwordResets).where(eq(passwordResets.anglerId, angler.id)));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(hashResetToken(token));
    expect(rows[0]!.tokenHash).not.toContain(token);
    expect(Date.parse(rows[0]!.expiresAt) - now).toBe(RESET_TOKEN_TTL_MS);
  });

  it("resets the password once, then rejects the same link", async () => {
    freshJournal();
    await registered();
    await forgot("angler@example.com");
    const token = tokenFrom(sent[0]!);
    expect(await resetTokenUsable(token)).toBe(true);

    const ok = await resetPasswordWithToken({ token, password: "new-password", confirm: "new-password", ip: "2.2.2.2" });
    expect(ok.ok).toBe(true);
    expect(await resetTokenUsable(token)).toBe(false);

    const again = await resetPasswordWithToken({ token, password: "other-pass1", confirm: "other-pass1", ip: "2.2.2.2" });
    expect(again).toMatchObject({ ok: false, error: RESET_LINK_INVALID });

    const oldLogin = await loginJournal({ email: "angler@example.com", password: "old-password", ip: "3.3.3.3" });
    expect(oldLogin).toMatchObject({ ok: false, error: AUTH_WRONG });
    const newLogin = await loginJournal({ email: "angler@example.com", password: "new-password", ip: "3.3.3.3" });
    expect(newLogin.ok).toBe(true);
  });

  it("uses the register password rules", async () => {
    freshJournal();
    await registered();
    await forgot("angler@example.com");
    const token = tokenFrom(sent[0]!);
    expect(await resetPasswordWithToken({ token, password: "short", confirm: "short", ip: "x" })).toMatchObject({
      ok: false,
      error: "Use at least 8 characters.",
    });
    expect(
      await resetPasswordWithToken({ token, password: "long-enough", confirm: "long-enougX", ip: "x" }),
    ).toMatchObject({ ok: false, error: "Passwords do not match." });
    // Failed attempts do not burn the link.
    expect(await resetTokenUsable(token)).toBe(true);
  });

  it("rejects an expired link and a made-up token", async () => {
    freshJournal();
    await registered();
    const issued = Date.parse("2026-10-16T12:00:00.000Z");
    const result = await requestPasswordReset({
      email: "angler@example.com",
      ip: "1.1.1.1",
      origin: "https://app.test",
      sender,
      now: issued,
    });
    if (result.ok) await result.send;
    const token = tokenFrom(sent[0]!);
    const late = issued + RESET_TOKEN_TTL_MS + 1;
    expect(await resetTokenUsable(token, late)).toBe(false);
    expect(
      await resetPasswordWithToken({ token, password: "new-password", confirm: "new-password", ip: "x", now: late }),
    ).toMatchObject({ ok: false, error: RESET_LINK_INVALID });
    expect(
      await resetPasswordWithToken({ token: "made-up", password: "new-password", confirm: "new-password", ip: "x" }),
    ).toMatchObject({ ok: false, error: RESET_LINK_INVALID });
  });

  it("keeps only the newest link per account", async () => {
    freshJournal();
    await registered();
    await forgot("angler@example.com");
    await forgot("angler@example.com");
    const first = tokenFrom(sent[0]!);
    const second = tokenFrom(sent[1]!);
    expect(await resetTokenUsable(first)).toBe(false);
    expect(await resetTokenUsable(second)).toBe(true);
  });

  it("signs out sessions issued before the reset", async () => {
    freshJournal();
    const angler = await registered();
    const realNow = Date.now;
    let oldSession = "";
    try {
      Date.now = () => realNow() - 60_000;
      oldSession = signSession(angler.id);
    } finally {
      Date.now = realNow;
    }
    expect(await requireViewerId(requestWithSession(oldSession))).toBe(angler.id);
    await forgot("angler@example.com");
    const token = tokenFrom(sent[0]!);
    expect((await resetPasswordWithToken({ token, password: "new-password", confirm: "new-password", ip: "x" })).ok).toBe(
      true,
    );
    expect(await requireViewerId(requestWithSession(oldSession))).toBeNull();
    expect(await requireViewerId(requestWithSession(signSession(angler.id)))).toBe(angler.id);
  });

  it("rate limits by IP with an error, and by email silently", async () => {
    freshJournal();
    await registered();
    for (let i = 0; i < 5; i += 1) {
      const res = await forgot("angler@example.com", `9.9.9.${i}`);
      expect(res).toMatchObject({ ok: true, message: FORGOT_GENERIC_MESSAGE });
    }
    expect(sent).toHaveLength(3);

    resetPasswordResetLimitsForTests();
    let last;
    for (let i = 0; i < 11; i += 1) last = await forgot(`nobody${i}@example.com`, "8.8.8.8");
    expect(last).toMatchObject({ ok: false, status: 429, error: FORGOT_RATE_LIMITED });
  });

  it("still answers generically when the email send fails", async () => {
    freshJournal();
    await registered();
    const result = await requestPasswordReset({
      email: "angler@example.com",
      ip: "1.1.1.1",
      origin: "https://app.test",
      sender: async () => {
        throw new Error("boom");
      },
    });
    expect(result).toMatchObject({ ok: true, message: FORGOT_GENERIC_MESSAGE });
    if (result.ok) await expect(result.send).resolves.toBeNull();
  });

  it("drops reset links when the account is deleted", async () => {
    freshJournal();
    const angler = await registered();
    await forgot("angler@example.com");
    await deleteAnglerAccount(angler.id);
    const rows = await allRows(getDb().select().from(passwordResets));
    expect(rows).toHaveLength(0);
  });

  it("builds links from APP_BASE_URL, the Render URL in production, or the dev origin", () => {
    expect(resetLinkOrigin({ requestOrigin: "https://evil.test", env: { APP_BASE_URL: "https://tide.example/" } })).toBe(
      "https://tide.example",
    );
    expect(resetLinkOrigin({ requestOrigin: "https://evil.test", env: { NODE_ENV: "production" } })).toBe(
      PRODUCTION_APP_URL,
    );
    expect(resetLinkOrigin({ requestOrigin: "http://localhost:3000", env: { NODE_ENV: "development" } })).toBe(
      "http://localhost:3000",
    );
  });

  it("writes a plain email with the link and an ignore line", () => {
    const mail = resetEmail({ to: "a@b.co", link: "https://x.test/reset-password?token=abc" });
    expect(mail.text).toContain("https://x.test/reset-password?token=abc");
    expect(mail.text).toContain("expires in 1 hour");
    expect(mail.text).toContain("you can ignore this email");
  });
});
