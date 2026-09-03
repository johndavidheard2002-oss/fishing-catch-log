import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { signSession } from "./auth";
import { createAngler, linkAnglers, listAnglers, listHouseholdProfiles, seedDefaultAngler } from "./db/anglers";
import { getDb, resetDbForTests } from "./db/index";
import { registerJournal } from "./auth";
import { ANGLER_COOKIE, SESSION_COOKIE, requireViewerId, resolveViewerId, viewerIdFromRequest } from "./viewer";

describe("viewer identity requires a signed-in session", () => {
  const previousPath = process.env.DATABASE_PATH;
  const tmpDirs: string[] = [];

  afterEach(() => {
    resetDbForTests();
    if (previousPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previousPath;
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  function freshJournal() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-viewer-"));
    tmpDirs.push(dir);
    process.env.DATABASE_PATH = path.join(dir, "journal.sqlite");
    resetDbForTests();
    getDb();
  }

  function requestWithCookie(value?: string) {
    const headers = new Headers();
    if (value) headers.set("cookie", `${ANGLER_COOKIE}=${value}`);
    return new NextRequest("http://localhost/api/me", { headers });
  }

  it("does not mint a journal for a request without a cookie", async () => {
    freshJournal();
    const first = await seedDefaultAngler();
    const before = (await listAnglers()).length;
    const unknown = await viewerIdFromRequest(requestWithCookie());
    expect(unknown).toBe("");
    expect(await requireViewerId(requestWithCookie())).toBeNull();
    expect(await resolveViewerId(undefined)).toBe("");
    expect((await listAnglers()).length).toBe(before);
    expect(first.id).toBeTruthy();
  });

  it("gives two sequential no-cookie requests no journal", async () => {
    freshJournal();
    await seedDefaultAngler();
    const a = await viewerIdFromRequest(requestWithCookie());
    const b = await viewerIdFromRequest(requestWithCookie());
    expect(a).toBe("");
    expect(b).toBe("");
  });

  it("keeps an unclaimed leftover cookie so Create account can claim that journal", async () => {
    freshJournal();
    const mine = await createAngler("Pat");
    const again = await resolveViewerId(mine.id);
    expect(again).toBe(mine.id);
    expect(await requireViewerId(requestWithCookie(mine.id))).toBeNull();
  });

  it("does not create an angler from a minted cookie id", async () => {
    freshJournal();
    const first = await seedDefaultAngler();
    const minted = crypto.randomUUID();
    const before = (await listAnglers()).length;
    expect(await resolveViewerId(minted)).toBe("");
    expect((await listAnglers()).length).toBe(before);
    expect(minted).not.toBe(first.id);
  });

  it("does not reuse a claimed journal from an anonymous cookie", async () => {
    freshJournal();
    const pat = await createAngler("Pat");
    const claimed = await registerJournal({
      viewerId: pat.id,
      name: "Pat",
      email: "pat@gulf.com",
      password: "password1",
      confirm: "password1",
    });
    expect(claimed.ok).toBe(true);
    const next = await resolveViewerId(pat.id);
    expect(next).toBe("");
    expect(await viewerIdFromRequest(requestWithCookie(pat.id))).toBe("");
  });

  it("prefers a signed session over the anonymous cookie", async () => {
    freshJournal();
    const pat = await createAngler("Pat");
    await registerJournal({
      viewerId: pat.id,
      name: "Pat",
      email: "pat@gulf.com",
      password: "password1",
      confirm: "password1",
    });
    const other = await createAngler("Other");
    const headers = new Headers();
    headers.set("cookie", `${ANGLER_COOKIE}=${other.id}; ${SESSION_COOKIE}=${signSession(pat.id)}`);
    const id = await viewerIdFromRequest(new NextRequest("http://localhost/api/me", { headers }));
    expect(id).toBe(pat.id);
    expect(await requireViewerId(new NextRequest("http://localhost/api/me", { headers }))).toBe(pat.id);
  });

  it("lists only this journal plus linked friends, not every angler", async () => {
    freshJournal();
    const me = await createAngler("Pat");
    const friend = await createAngler("Sam");
    const stranger = await createAngler("Other tester");
    await linkAnglers(me.id, friend.id);
    const profiles = await listHouseholdProfiles(me.id);
    expect(profiles.map((row) => row.id).sort()).toEqual([friend.id, me.id].sort());
    expect(profiles.some((row) => row.id === stranger.id)).toBe(false);
  });
});
